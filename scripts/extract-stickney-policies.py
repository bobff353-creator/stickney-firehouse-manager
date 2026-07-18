"""Extract the approved Stickney Fire Department policy PDFs into seed data.

Usage:
  python scripts/extract-stickney-policies.py E:\\Policies db/policy-seed.json
"""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime
from pathlib import Path

import pdfplumber


FILENAME_RE = re.compile(
    r"^POLICY\s+(?P<number>\d+)\s*-\s*(?P<title>.*?)\s*-\s*FINAL\s+(?P<date>\d{8})\.pdf$",
    re.IGNORECASE,
)

CATEGORY_RANGES = (
    (100, 199, "Department Administration"),
    (200, 299, "Administrative Operations"),
    (300, 399, "Emergency Operations"),
    (400, 499, "Fire Prevention"),
    (500, 599, "Emergency Medical Services"),
    (600, 699, "Training"),
    (700, 799, "Equipment and Communications"),
    (800, 899, "Records and Privacy"),
    (900, 999, "Health and Safety"),
    (1000, 1099, "Personnel"),
    (1100, 1199, "Facilities"),
)

ACRONYMS = {
    "Aed": "AED",
    "Atv": "ATV",
    "Cpr": "CPR",
    "Ems": "EMS",
    "Nfirs": "NFIRS",
    "Nims": "NIMS",
    "Pia": "PIA",
    "Usar": "USAR",
    "Utv": "UTV",
}


def category_for(policy_number: int) -> str:
    for start, end, category in CATEGORY_RANGES:
        if start <= policy_number <= end:
            return category
    return "General"


def title_from_filename(raw_title: str) -> str:
    title = re.sub(r"\s+", " ", raw_title.strip()).title()
    for source, replacement in ACRONYMS.items():
        title = re.sub(rf"\b{source}\b", replacement, title)
    return title.replace(" - ", " - ")


def extract_effective_date(first_page_text: str, fallback: str) -> str:
    metadata_line = next(
        (
            line.strip()
            for line in first_page_text.splitlines()
            if re.search(r"[A-Za-z]+\s+\d{1,2},\s+\d{4}", line)
        ),
        "",
    )
    match = re.search(r"([A-Za-z]+\s+\d{1,2},\s+\d{4})", metadata_line)
    if match:
        try:
            return datetime.strptime(match.group(1), "%B %d, %Y").date().isoformat()
        except ValueError:
            pass
    return datetime.strptime(fallback, "%m%d%Y").date().isoformat()


def clean_page_text(text: str, policy_number: str, first_page: bool) -> str:
    text = text.replace("\u00ad", "").replace("\x00", "")
    if first_page:
        purpose = re.search(r"(?m)^PURPOSE\s*:?\s*$", text)
        if purpose:
            text = text[purpose.start() :]

    cleaned_lines: list[str] = []
    footer = re.compile(
        rf"^SFD\s+{re.escape(policy_number)}\s+.*?Page\s+\d+\s+of\s+\d+\s*$",
        re.IGNORECASE,
    )
    for line in text.splitlines():
        stripped = line.strip()
        if footer.match(stripped):
            continue
        if re.fullmatch(r"Page\s+\d+\s+of\s+\d+", stripped, re.IGNORECASE):
            continue
        cleaned_lines.append(stripped)

    text = "\n".join(cleaned_lines)
    text = re.sub(r"(?<=\w)-\n(?=[a-z])", "", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_policy(pdf_path: Path) -> dict[str, str]:
    match = FILENAME_RE.match(pdf_path.name)
    if not match:
        raise ValueError(f"Unexpected policy filename: {pdf_path.name}")

    number = match.group("number")
    pages: list[str] = []
    with pdfplumber.open(pdf_path) as pdf:
        for index, page in enumerate(pdf.pages):
            raw = page.extract_text(x_tolerance=2, y_tolerance=3) or ""
            pages.append(clean_page_text(raw, number, index == 0))

    first_page = pages[0] if pages else ""
    body = "\n\n".join(page for page in pages if page).strip()
    if len(body) < 100:
        raise ValueError(f"Extracted text is unexpectedly short: {pdf_path.name}")

    return {
        "id": f"sfd-policy-{number}",
        "policyNumber": number,
        "title": title_from_filename(match.group("title")),
        "category": category_for(int(number)),
        "effectiveDate": extract_effective_date(first_page, match.group("date")),
        "body": body,
        "sourceFile": pdf_path.name,
    }


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("Usage: extract-stickney-policies.py <PDF folder> <output JSON>")

    source_dir = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    pdfs = sorted(source_dir.glob("POLICY *.pdf"), key=lambda path: int(FILENAME_RE.match(path.name).group("number")) if FILENAME_RE.match(path.name) else 999999)
    policies = [extract_policy(pdf) for pdf in pdfs]

    numbers = [policy["policyNumber"] for policy in policies]
    if len(numbers) != len(set(numbers)):
        raise ValueError("Duplicate policy numbers were found.")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(policies, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Extracted {len(policies)} policies to {output_path}")


if __name__ == "__main__":
    main()
