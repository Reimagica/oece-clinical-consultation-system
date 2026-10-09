"""Import the user-supplied national clinical disease names for search.

Usage: python scripts/import-diagnosis-catalog.py SOURCE.xls
Requires xlrd for the legacy .xls format. No patient records are imported.
"""
import json
import sys
from pathlib import Path

import xlrd

source = Path(sys.argv[1])
sheet = xlrd.open_workbook(str(source), on_demand=True).sheet_by_index(0)
assert sheet.row_values(0)[:3] == ["ficdm", "fjbname", "fzjc"]
rows = []
for index in range(1, sheet.nrows):
    code, name, abbreviation = (str(value).strip() for value in sheet.row_values(index)[:3])
    if code and name:
        rows.append({"code": code, "name": name, "abbreviation": abbreviation})
assert len(rows) == 37294, len(rows)
assert len({row["code"] for row in rows}) == len(rows)
assert any(row["name"] == "慢性阻塞性肺疾病I级" for row in rows)
assert any(row["name"] == "间质性肺病" for row in rows)
rows.append({"code": "DEMO-HF-001", "name": "急性失代偿性心力衰竭", "abbreviation": "jxsdcsxljs"})
output = Path(__file__).resolve().parents[1] / "app" / "diagnosis-catalog.json"
output.write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"Imported {len(rows)} records to {output}")
