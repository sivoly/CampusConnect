"""Helper script to generate valid sample PDF attachments for CampusConnect demo."""
from pathlib import Path

def create_simple_pdf(title: str, lines: list[str]) -> bytes:
    # Build a valid minimal PDF 1.4
    content_lines = [
        "BT",
        "/F1 18 Tf",
        "50 720 Td",
        f"({title}) Tj",
        "/F1 12 Tf",
        "0 -30 Td",
    ]
    for line in lines:
        escaped = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        content_lines.append(f"({escaped}) Tj")
        content_lines.append("0 -18 Td")
    content_lines.append("ET")
    
    stream_content = "\n".join(content_lines).encode("latin1")
    stream_len = len(stream_content)

    pdf = bytearray()
    pdf.extend(b"%PDF-1.4\n")
    
    offsets = []
    
    # Obj 1: Catalog
    offsets.append(len(pdf))
    pdf.extend(b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")
    
    # Obj 2: Pages
    offsets.append(len(pdf))
    pdf.extend(b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n")
    
    # Obj 3: Page
    offsets.append(len(pdf))
    pdf.extend(
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"
    )
    
    # Obj 4: Stream
    offsets.append(len(pdf))
    pdf.extend(f"4 0 obj\n<< /Length {stream_len} >>\nstream\n".encode("latin1"))
    pdf.extend(stream_content)
    pdf.extend(b"\nendstream\nendobj\n")
    
    # Obj 5: Font
    offsets.append(len(pdf))
    pdf.extend(b"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n")
    
    # Xref table
    xref_offset = len(pdf)
    pdf.extend(b"xref\n0 6\n0000000000 65535 f \n")
    for offset in offsets:
        pdf.extend(f"{offset:010d} 00000 n \n".encode("latin1"))
        
    pdf.extend(
        b"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n"
        + str(xref_offset).encode("latin1")
        + b"\n%%EOF\n"
    )
    return bytes(pdf)


def main():
    uploads_dir = Path(__file__).resolve().parent / "storage" / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)
    
    # Sample 1: Exam Schedule
    exam_pdf = create_simple_pdf(
        "CampusConnect - Autumn 2026 Examination Schedule",
        [
            "Office of the Controller of Examinations",
            "Published: October 2026 | Priority: Urgent",
            "----------------------------------------------------------------",
            "Branch: Computer Science & Engineering (Sem 5 & 7)",
            "  - CS501 Advanced Database Systems: Nov 18, 2026 (09:30 - 12:30)",
            "  - CS502 Network Security & Cryptography: Nov 21, 2026 (09:30 - 12:30)",
            "  - CS503 Distributed Cloud Architectures: Nov 24, 2026 (09:30 - 12:30)",
            "",
            "Instructions for Candidates:",
            "  1. Hall tickets must be verified with college seal 48h prior.",
            "  2. Entry closes 15 minutes before exam commencement.",
            "  3. Programmable calculators and cellular devices are prohibited."
        ]
    )
    (uploads_dir / "sample_exam_schedule.pdf").write_bytes(exam_pdf)
    
    # Sample 2: Hall Allocation
    hall_pdf = create_simple_pdf(
        "CampusConnect - Mid-Term Seating & Hall Allocation",
        [
            "Dean of Academics - Examination Infrastructure Cell",
            "----------------------------------------------------------------",
            "Block C - 1st & 2nd Floor:",
            "  - Hall C-101: Roll No. CS24001 to CS24060 (Room Capacity: 60)",
            "  - Hall C-102: Roll No. CS24061 to CS24120 (Room Capacity: 60)",
            "  - Hall C-201: Roll No. IT24001 to IT24060 (Room Capacity: 60)",
            "",
            "Block D - Engineering Wing:",
            "  - Hall D-105: Roll No. ME24001 to ME24050 (Mechanical Eng)",
            "  - Hall D-208: Roll No. EE24001 to EE24050 (Electrical Eng)",
            "",
            "Please reach your assigned hall 20 minutes prior to paper distribution."
        ]
    )
    (uploads_dir / "sample_hall_allocation.pdf").write_bytes(hall_pdf)
    
    # Sample 3: Hackathon
    hack_pdf = create_simple_pdf(
        "HackConnect 2026 - National Student Hackathon",
        [
            "Department of Student Affairs & Innovation Hub",
            "----------------------------------------------------------------",
            "Event Dates: November 12 - 14, 2026 (36 Hours Non-Stop)",
            "Location: Central Tech Arena & Innovation Incubation Centre",
            "",
            "Tracks:",
            "  1. Next-Gen Generative AI Applications",
            "  2. Cyber Defense & Privacy-First Architectures",
            "  3. Sustainable Green Campus & Smart IoT",
            "",
            "Prizes & Mentorship:",
            "  - 1st Place: $5,000 + Venture Seed Incubator Grant",
            "  - 2nd Place: $3,000 + Cloud Credits",
            "  - 3rd Place: $2,000",
            "",
            "Registration deadline: November 05, 2026 via Student Portal."
        ]
    )
    (uploads_dir / "sample_hackathon.pdf").write_bytes(hack_pdf)
    
    print("Successfully generated all sample PDFs in storage/uploads.")

if __name__ == "__main__":
    main()
