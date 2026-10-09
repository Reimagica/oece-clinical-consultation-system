/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS regression harness. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name);
  const source = fs.readFileSync(path.join(__dirname, '../app', name + '.ts'), 'utf8');
  const compiledModule = { exports: {} };
  cache.set(name, compiledModule.exports);
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(js, { module: compiledModule, exports: compiledModule.exports, require: n => load(n.replace('./', '')), Date, JSON, console });
  return compiledModule.exports;
}
const data = load('demo-data'), { buildDimensions } = load('assessment');
const { restoreDemoState, updateActiveAttempt } = load('attempt-state');
const checks = load('case-checks');
const attempt = data.emptyAttempt('test');
const exam = { id: 'test', policy: data.defaultExamPolicy };
let count = 0;
function test(name, run) { run(); count++; console.log('PASS', name); }
test('effective maximums stay 292 / 275 / 277 / 260', () => {
  for (const [physical, auxiliary, expected] of [[true,true,292],[false,true,275],[true,false,277],[false,false,260]]) {
    const dimensions = buildDimensions({ policy: { physicalOrderScoringEnabled: physical, auxiliaryOrderScoringEnabled: auxiliary } }, attempt);
    assert.equal(dimensions.reduce((sum,d) => sum + (d.maximum ?? 0),0), expected);
  }
});
test('negated clinical text never gets automatic positive points', () => {
  const text = '未见颈静脉怒张，无双肺啰音，BNP未升高，肝功能正常，胸片未见肺淤血，无胸腔积液，无低氧，未闻及心尖杂音';
  const dims = buildDimensions(exam, { ...attempt, casePresentation: text, plan: '不使用利尿剂或SGLT2', treatment: '未给予氧疗' });
  for (const id of ['history','stage','treatment']) assert.equal(dims.find(d=>d.id===id).earned, 0);
  assert.equal(dims.find(d=>d.id==='final').items.find(x=>x.label==='双肺啰音').earned,0);
  assert.equal(dims.find(d=>d.id==='final').items.find(x=>x.label==='胸腔积液').earned,0);
});
test('live experience never enters history score or evidence', () => {
  const dims = buildDimensions(exam, {...attempt, transcript: [{id:'actual-7', speaker:'patient', text:'未记载的信息', stage:3, time:'12:01', mode:'live'}]});
  assert.equal(dims[0].items[0].evidence,undefined);
  assert.equal(dims[0].earned,0);
  const state={role:'student',exam,attempt:{...attempt,transcript:[{id:'actual-7',speaker:'patient',text:'体验',mode:'live',time:'12:01'}]}};
  assert.equal(restoreDemoState(JSON.stringify(state)).attempt.transcript.length,0);
});
test('history points require a scripted student question and retain the excerpt', () => {
  const patientOnly = buildDimensions(exam,{...attempt,transcript:[{id:'p',speaker:'patient',text:'我咳嗽很久了',time:'12:00',mode:'scripted'}]});
  assert.equal(patientOnly[0].items[0].earned,0);
  const asked = buildDimensions(exam,{...attempt,transcript:[{id:'q',speaker:'student',text:'您咳嗽多久了？',time:'12:00',mode:'scripted'},{id:'p',speaker:'patient',text:'三个月',time:'12:01',mode:'scripted'}]});
  assert.equal(asked[0].items[0].earned,2);
  assert.match(asked[0].items[0].evidence,/考生：.*咳嗽/);
  assert.match(asked[0].items[0].evidence,/患者：三个月/);
});
test('diagnosis catalog has the supplied source and all demo terms', () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(__dirname,'../app/diagnosis-catalog.json'),'utf8'));
  assert.equal(catalog.length,37295);
  for (const name of ['急性失代偿性心力衰竭','间质性肺病','慢性阻塞性肺疾病I级']) assert.ok(catalog.some(item=>item.name===name),name);
  const demoCopd = data.diagnosisLibrary.find(item=>item.name==='慢性阻塞性肺疾病IV级');
  assert.ok(demoCopd,'demo-data diagnosisLibrary must name 慢性阻塞性肺疾病IV级');
  assert.ok(catalog.some(item=>item.name===demoCopd.name),'demo diagnosis term must exist in catalog');
});
test('aliases share results; BNP is not substituted with NT-proBNP', () => {
  assert.equal(checks.canonicalCheck('胸片'),'胸部X线');
  assert.equal(checks.checkResultText('ECG'),checks.checkResultText('心电图'));
  assert.equal(checks.canonicalCheck('BNP'),'BNP');
  assert.equal(checks.duplicateChecks([{label:'胸片'},{label:'胸部X线'}]),true);
});
test('repeat selections cannot double score', () => {
  const e = {policy:{physicalOrderScoringEnabled:false,auxiliaryOrderScoringEnabled:false}};
  const single = { ...attempt, physicalItems:[{id:'a', label:'心脏听诊', interpretation:''}] };
  assert.equal(buildDimensions(e,single)[1].earned,10);
  assert.equal(buildDimensions(e,{...single,physicalItems:[...single.physicalItems,...single.physicalItems]})[1].earned,10);
});
test('equal-priority items can swap without lost order points', () => {
  const labels=['双肺听诊','心脏听诊','肝颈静脉回流征','颈静脉怒张检查','下肢水肿检查'];
  const dims=buildDimensions(exam,{...attempt,physicalItems:labels.map((label,i)=>({id:String(i),label,interpretation:''}))});
  assert.equal(dims[1].earned,50);
});
test('missing higher-priority item does not silently award full order points', () => {
  const dims=buildDimensions(exam,{...attempt,physicalItems:[{id:'p',label:'下肢水肿检查',interpretation:''}]});
  assert.equal(dims[1].items.find(x=>x.label==='下肢水肿检查').earned,null);
});
test('submitted attempt ignores late callbacks', () => {
  const state={role:'student',exam,attempt:{...attempt,status:'submitted'}};
  assert.equal(updateActiveAttempt(state,a=>({...a,casePresentation:'late'})),state);
});
test('draft survives restore and malformed data is rejected', () => {
  const state={role:'student',exam,attempt:{...attempt,patientDraft:'下一次问题',casePresentation:'我的汇报'}};
  assert.equal(restoreDemoState(JSON.stringify(state)).attempt.patientDraft,'');
  assert.equal(restoreDemoState(JSON.stringify(state)).attempt.casePresentation,'我的汇报');
  assert.throws(()=>restoreDemoState('{'));
  assert.throws(()=>restoreDemoState(JSON.stringify({...state,attempt:{...attempt,currentStage:99}})));
});
test('source results retain omitted findings and complete panels', () => {
  assert.match(checks.physicalFindings['心脏听诊'],/S2后/);
  assert.match(checks.physicalFindings['肝颈静脉回流征'],/10秒/);
  assert.equal(checks.laboratoryResults['血常规'].length,5);
  assert.equal(checks.laboratoryResults['肝功能'].length,9);
  assert.match(checks.testReports['胸部X线'],/纵隔/);
});
test('stage four starts with case report, removes redundant recaps and has one final submit', () => {
  const source = fs.readFileSync(path.join(__dirname, '../app/demo-app.tsx'), 'utf8');
  const final = source.slice(source.indexOf('function FinalStage('));
  assert.equal(final.includes('diagnosis-evolution'),false);
  assert.equal(final.includes('case-recap'),false);
  assert.ok(final.indexOf('病例汇报原文') < final.indexOf('诊断与依据'));
  assert.equal((final.match(/确认并提交整场考试/g) || []).length, 1);
});
const scoring = load('score-policy'), flow = load('check-results');
test('percentage total uses equal dimension ratios, never raw point sums', () => {
  const dimensions = [72,50,50,20,90,10].map((maximum,index)=>({id:scoring.scoringDimensions[index].id, maximum,earned:maximum/2}));
  assert.equal(scoring.weightedScore(dimensions),50);
  dimensions[0].earned=72;
  assert.equal(scoring.weightedScore(dimensions),58.3);
  dimensions.push({id:'reasoning',maximum:null,earned:null});
  assert.equal(scoring.weightedScore(dimensions),58.3);
});
test('custom weights, exclusions and pending review are explicit', () => {
  const dimensions=[{id:'history',maximum:72,earned:72},{id:'physical',maximum:50,earned:0}];
  assert.equal(scoring.weightedScore(dimensions,{history:3,physical:1}),75);
  dimensions[1].earned=null;
  assert.equal(scoring.weightedScore(dimensions,{history:3,physical:1}),null);
  assert.equal(scoring.weightedScore(dimensions,{history:3,physical:0}),100);
  const zero=Object.fromEntries(scoring.scoringDimensions.map(d=>[d.id,0]));
  assert.equal(scoring.normalizeWeights(zero).history,1);
  assert.equal(scoring.normalizeWeights({history:-1}).history,1);
});
test('all four order policies still yield 100 when dimensions are full', () => {
  for (const [physical,auxiliary] of [[true,true],[false,true],[true,false],[false,false]]) {
    const dimensions=buildDimensions({policy:{physicalOrderScoringEnabled:physical,auxiliaryOrderScoringEnabled:auxiliary}},attempt).map(d=>({...d,earned:d.maximum}));
    assert.equal(scoring.weightedScore(dimensions),100);
  }
});
test('ranking uses unique highest scores within case and score policy', () => {
  const base={caseId:'case-a',scoringKey:'equal'};
  const ranked=scoring.bestScores([{...base,learnerId:'a',name:'A',score:70},{...base,learnerId:'a',name:'A',score:90},{...base,learnerId:'b',name:'B',score:80},{...base,learnerId:'c',name:'C',score:100,caseId:'other'},{...base,learnerId:'d',name:'D',score:100,scoringKey:'different'}],'case-a','equal');
  assert.equal(ranked.length,2); assert.equal(ranked[0].learnerId,'a'); assert.equal(ranked[0].score,90);
  assert.equal(scoring.scoringKey({...data.defaultExamPolicy,dimensionWeights:{history:1}}),scoring.scoringKey(data.defaultExamPolicy));
});
test('a later check cannot generate before prior results are completed', () => {
  const items=[{label:'心脏听诊',interpretation:''},{label:'双肺听诊',interpretation:''}];
  assert.equal(flow.canGenerateCheck(items,0),true);
  assert.equal(flow.canGenerateCheck(items,1),false);
  items[0].result=flow.fixedCheckResult('physical','心脏听诊');
  assert.equal(flow.canGenerateCheck(items,1),true);
  items[0].result=flow.fixedCheckResult('physical','腹部检查');
  assert.equal(flow.canGenerateCheck(items,1),false);
  const changed=flow.clearCheckResult({...items[1],result:flow.fixedCheckResult('physical','双肺听诊'),interpretation:'已有分析',generatedAt:'old'},'下肢水肿检查');
  assert.equal(changed.result,undefined); assert.equal(changed.interpretation,''); assert.equal(changed.generatedAt,undefined);
});
test('reporter distinguishes broad, unknown and individual-analyte requests', () => {
  assert.equal(flow.fixedCheckResult('physical','腹部检查').kind,'clarification');
  assert.equal(flow.fixedCheckResult('physical','腹部压痛').text,'未见异常。');
  assert.equal(flow.fixedCheckResult('auxiliary','CT').text,'请说明具体检查项目或部位。');
  assert.equal(flow.fixedCheckResult('auxiliary','血液检查').kind,'clarification');
  assert.equal(flow.fixedCheckResult('auxiliary','胸部CT').text,'未进行该项检查。');
  const creatinine=flow.fixedCheckResult('auxiliary','肌酐');
  assert.equal(creatinine.rows.length,1); assert.equal(creatinine.rows[0][1],'1.8');
  assert.equal(flow.fixedCheckResult('auxiliary','血常规').rows.length,5);
  assert.ok(!flow.fixedCheckResult('physical','心脏听诊').text.includes('提示'));
});
test('legacy reveal and COPD label migrate without losing written answers', () => {
  const saved={role:'student',exam,attempt:{...attempt,physicalRevealed:true,physicalItems:[{id:'p',label:'心脏听诊',interpretation:'原分析'}],historyDiagnoses:[{id:'d',name:'慢性阻塞性肺疾病I级',support:'原依据',isPrimary:false}]}};
  const restored=restoreDemoState(JSON.stringify(saved));
  assert.ok(restored.attempt.physicalItems[0].result);
  assert.equal(restored.attempt.physicalItems[0].interpretation,'原分析');
  assert.equal(restored.attempt.historyDiagnoses[0].name,'慢性阻塞性肺疾病IV级');
  assert.equal(restored.attempt.historyDiagnoses[0].support,'原依据');
  assert.equal(restored.exam.policy.dimensionWeights.history,1);
});
test('model matching never broadens precise feedback or supplies invented results', () => {
  const exact=flow.matchedCheckResult('auxiliary','肌酐',{kind:'result',key:'血生化'});
  assert.equal(exact.rows.length,1); assert.equal(exact.rows[0][0],'肌酐');
  assert.equal(flow.matchedCheckResult('auxiliary','CT',{kind:'result',key:'胸部X线'}).kind,'clarification');
  assert.equal(flow.matchedCheckResult('auxiliary','其他项目',{kind:'result',key:'捏造结果'}).kind,'unavailable');
  assert.equal(flow.matchedCheckResult('physical','请听听两肺',{kind:'result',key:'双肺听诊'}).text,checks.physicalFindings['双肺听诊']);
});
console.log(`${count} regression checks passed.`);
