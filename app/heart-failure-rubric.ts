// Imported from 25练习一 心衰 病例信息及评分标准.docx; keep Word as source of truth.
export type WordRubricItem = { group: string; section: string; label: string; max: number };
export const historyRubric: WordRubricItem[] = [
  {
    "group": "问诊内容",
    "section": "开始",
    "label": "问明主要症状：咳嗽",
    "max": 2
  },
  {
    "group": "问诊内容",
    "section": "开始",
    "label": "问明主要症状：呼吸困难",
    "max": 2
  },
  {
    "group": "问诊内容",
    "section": "主诉",
    "label": "加重时间：3个月",
    "max": 2
  },
  {
    "group": "问诊内容",
    "section": "主诉",
    "label": "确认：4年前首发",
    "max": 2
  },
  {
    "group": "问诊内容",
    "section": "现病史-主要症状特点",
    "label": "咳嗽诱因：活动诱发；",
    "max": 2
  },
  {
    "group": "问诊内容",
    "section": "现病史-主要症状特点",
    "label": "咳嗽性质：干咳/无痰",
    "max": 2
  },
  {
    "group": "问诊内容",
    "section": "现病史-主要症状特点",
    "label": "咳嗽频率：间歇性",
    "max": 2
  },
  {
    "group": "问诊内容",
    "section": "现病史-主要症状特点",
    "label": "发作情况：反复",
    "max": 2
  },
  {
    "group": "问诊内容",
    "section": "现病史-主要症状特点",
    "label": "加重因素：寒冷天气",
    "max": 2
  },
  {
    "group": "问诊内容",
    "section": "现病史-主要症状特点",
    "label": "诱因变化：无明显诱因/全天可发作",
    "max": 2
  },
  {
    "group": "问诊内容",
    "section": "现病史-主要症状特点",
    "label": "变化情况：持续性",
    "max": 1
  },
  {
    "group": "问诊内容",
    "section": "现病史-主要症状特点",
    "label": "变化情况：夜间明显",
    "max": 1
  },
  {
    "group": "问诊内容",
    "section": "现病史-主要症状特点",
    "label": "变化情况：少量",
    "max": 1
  },
  {
    "group": "问诊内容",
    "section": "现病史-主要症状特点",
    "label": "变化情况：白色/透明痰",
    "max": 1
  },
  {
    "group": "问诊内容",
    "section": "现病史-主要症状特点",
    "label": "呼吸困难诱因：登数层楼/爬山",
    "max": 2
  },
  {
    "group": "问诊内容",
    "section": "现病史-主要症状特点",
    "label": "诱因变化：平地行走",
    "max": 2
  },
  {
    "group": "问诊内容",
    "section": "现病史-主要症状特点",
    "label": "缓解因素：休息",
    "max": 2
  },
  {
    "group": "问诊内容",
    "section": "现病史-主要症状特点",
    "label": "加重因素：夜间明显/影响入睡",
    "max": 2
  },
  {
    "group": "问诊内容",
    "section": "现病史-主要症状特点",
    "label": "水肿：双侧",
    "max": 2
  },
  {
    "group": "问诊内容",
    "section": "现病史-主要症状特点",
    "label": "水肿：间歇性",
    "max": 2
  },
  {
    "group": "问诊内容",
    "section": "现病史-主要症状特点",
    "label": "水肿：踝关节",
    "max": 2
  },
  {
    "group": "问诊内容",
    "section": "现病史-伴随症状",
    "label": "伴随症状：乏力、",
    "max": 2
  },
  {
    "group": "问诊内容",
    "section": "现病史-伴随症状",
    "label": "无咯血、心悸、出汗、发热、胸痛、发绀、喘息",
    "max": 7
  },
  {
    "group": "问诊内容",
    "section": "现病史-伴随症状",
    "label": "膝关节疼痛、麻木感",
    "max": 2
  },
  {
    "group": "问诊内容",
    "section": "现病史-伴随症状",
    "label": "腰背部、钝痛",
    "max": 2
  },
  {
    "group": "问诊内容",
    "section": "现病史-诊治经过",
    "label": "就诊经过：无",
    "max": 1
  },
  {
    "group": "问诊内容",
    "section": "现病史-一般情况",
    "label": "食欲减退",
    "max": 1
  },
  {
    "group": "问诊内容",
    "section": "现病史-一般情况",
    "label": "体重增加约5kg",
    "max": 2
  },
  {
    "group": "问诊内容",
    "section": "现病史-一般情况",
    "label": "小便未见异常",
    "max": 1
  },
  {
    "group": "问诊内容",
    "section": "既往史",
    "label": "5年前心梗、植入冠脉支架",
    "max": 2
  },
  {
    "group": "问诊内容",
    "section": "既往史",
    "label": "无哮喘病史",
    "max": 1
  },
  {
    "group": "问诊内容",
    "section": "既往史",
    "label": "高血压、高脂血症、2型糖尿病、慢性肾病",
    "max": 1
  },
  {
    "group": "问诊内容",
    "section": "既往史",
    "label": "近2年未规律复诊",
    "max": 1
  },
  {
    "group": "问诊内容",
    "section": "既往史",
    "label": "磺胺类药物过敏",
    "max": 1
  },
  {
    "group": "问诊内容",
    "section": "个人史",
    "label": "吸烟20年、每日约半包",
    "max": 2
  },
  {
    "group": "问诊内容",
    "section": "个人史",
    "label": "近期因行走困难未规律运动",
    "max": 2
  },
  {
    "group": "问诊内容",
    "section": "婚姻史",
    "label": "54岁绝经",
    "max": 1
  },
  {
    "group": "问诊内容",
    "section": "家族史",
    "label": "父/母均有高血压/糖尿病",
    "max": 1
  },
  {
    "group": "问诊内容",
    "section": "家族史",
    "label": "父亲因肺癌去世",
    "max": 1
  },
  {
    "group": "问诊内容",
    "section": "家族史",
    "label": "母亲因心脏病去世",
    "max": 1
  },
  {
    "group": "问诊内容",
    "section": "结束",
    "label": "主动问患者有什么需求、结束语",
    "max": 2
  }
];
export const caseSummaryRubric: WordRubricItem[] = [
  {
    "group": "58 岁/中年、女性",
    "section": "",
    "label": "58 岁/中年、女性",
    "max": 2
  },
  {
    "group": "患有冠状动脉疾病、高血压",
    "section": "",
    "label": "患有冠状动脉疾病、高血压",
    "max": 4
  },
  {
    "group": "慢性咳嗽",
    "section": "",
    "label": "慢性咳嗽",
    "max": 3
  },
  {
    "group": "进行性加重",
    "section": "",
    "label": "进行性加重",
    "max": 3
  },
  {
    "group": "劳力性呼吸困难",
    "section": "",
    "label": "劳力性呼吸困难",
    "max": 3
  },
  {
    "group": "低氧血症",
    "section": "",
    "label": "低氧血症",
    "max": 3
  },
  {
    "group": "左心室容量超负荷",
    "section": "",
    "label": "左心室容量超负荷",
    "max": 3
  },
  {
    "group": "二尖瓣关闭不全杂音",
    "section": "",
    "label": "二尖瓣关闭不全杂音",
    "max": 3
  },
  {
    "group": "NT-proBNP 水平升高",
    "section": "",
    "label": "NT-proBNP 水平升高",
    "max": 3
  },
  {
    "group": "影像学检查显示有肺水肿",
    "section": "",
    "label": "影像学检查显示有肺水肿",
    "max": 3
  }
];
export const diagnosticEvidenceRubric: WordRubricItem[] = [
  {
    "group": "颈静脉怒张、颈静脉回流征阳性、下肢水肿",
    "section": "",
    "label": "颈静脉怒张、颈静脉回流征阳性、下肢水肿",
    "max": 6
  },
  {
    "group": "双肺啰音",
    "section": "",
    "label": "双肺啰音",
    "max": 5
  },
  {
    "group": "BNP升高",
    "section": "",
    "label": "BNP升高",
    "max": 5
  },
  {
    "group": "转氨酶升高/肝功能异常",
    "section": "",
    "label": "转氨酶升高/肝功能异常",
    "max": 2
  },
  {
    "group": "胸片见肺淤血",
    "section": "",
    "label": "胸片见肺淤血",
    "max": 3
  },
  {
    "group": "胸腔积液",
    "section": "",
    "label": "胸腔积液",
    "max": 3
  },
  {
    "group": "心肺运动试验提示低氧血症",
    "section": "",
    "label": "心肺运动试验提示低氧血症",
    "max": 3
  },
  {
    "group": "心尖区杂音",
    "section": "",
    "label": "心尖区杂音",
    "max": 3
  }
];
export const treatmentRubric: WordRubricItem[] = [
  {
    "group": "饮食限制钠、限水、吸氧",
    "section": "",
    "label": "饮食限制钠、限水、吸氧",
    "max": 2
  },
  {
    "group": "利尿（呋塞米/醛固酮）",
    "section": "",
    "label": "利尿（呋塞米/醛固酮）",
    "max": 2
  },
  {
    "group": "改善心肌代谢：SGLT2 抑制剂",
    "section": "",
    "label": "改善心肌代谢：SGLT2 抑制剂",
    "max": 2
  },
  {
    "group": "β受体阻滞剂",
    "section": "",
    "label": "β受体阻滞剂",
    "max": 2
  },
  {
    "group": "ACEI/ARB/ARNI",
    "section": "",
    "label": "ACEI/ARB/ARNI",
    "max": 2
  }
];
