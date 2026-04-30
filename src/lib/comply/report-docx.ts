import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  ShadingType,
} from "docx";
import {
  getCategoryLabel,
  getCategoryVolume,
  getCategoryStatus,
  DISCIPLINE_LABELS,
  type ContributorDiscipline,
} from "@/lib/ai/types";

interface Finding {
  ncc_section: string;
  category: string;
  title: string;
  description: string;
  recommendation: string | null;
  severity: "compliant" | "advisory" | "non_compliant" | "critical";
  confidence: number;
  ncc_citation: string | null;
  page_references: number[] | null;
  responsible_discipline?: string | null;
  remediation_action?: string | null;
  review_status?: string | null;
  assigned_contributor_id?: string | null;
}

interface ReportData {
  projectName: string;
  projectAddress: string | null;
  summary: string;
  overallRisk: "low" | "medium" | "high" | "critical";
  completedAt: string;
  findings: Finding[];
}

const SEVERITY_LABELS: Record<string, string> = {
  compliant: "Compliant",
  advisory: "Advisory",
  non_compliant: "Non-Compliant",
  critical: "Critical",
};

const RISK_LABELS: Record<string, string> = {
  low: "Low Risk",
  medium: "Medium Risk",
  high: "High Risk",
  critical: "Critical Risk",
};

const HEADER_SHADING = { type: ShadingType.SOLID, color: "1E1E1E", fill: "1E1E1E" };

function headerCell(text: string, width = 25): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    shading: HEADER_SHADING,
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 18 })],
      }),
    ],
  });
}

function cell(text: string, opts: { bold?: boolean; color?: string; width?: number } = {}): TableCell {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    children: [
      new Paragraph({
        children: [
          new TextRun({ text: text || "-", bold: opts.bold ?? false, color: opts.color, size: 18 }),
        ],
      }),
    ],
  });
}

function severityColor(sev: string): string | undefined {
  if (sev === "Critical" || sev === "Non-Compliant") return "B40000";
  if (sev === "Advisory") return "B48200";
  if (sev === "Compliant") return "008C00";
  return undefined;
}

function getDisciplineLabel(d?: string | null): string {
  if (!d) return "-";
  return DISCIPLINE_LABELS[d as ContributorDiscipline] ?? d.replace(/_/g, " ");
}

export async function generateComplianceDocx(data: ReportData): Promise<Buffer> {
  const categories = [...new Set(data.findings.map((f) => f.category))];

  const children: (Paragraph | Table)[] = [];

  // Header band
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `MMC Build — NCC Compliance Report   |   Generated ${new Date(data.completedAt).toLocaleDateString("en-AU")}`,
          color: "646464",
          size: 18,
        }),
      ],
    }),
    new Paragraph({ text: "" })
  );

  // Title
  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun({ text: data.projectName, bold: true, size: 40 })],
    })
  );
  if (data.projectAddress) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: data.projectAddress, color: "505050", size: 22 })],
      })
    );
  }
  children.push(new Paragraph({ text: "" }));

  // Overall risk
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Overall Risk Assessment: ${RISK_LABELS[data.overallRisk] ?? data.overallRisk}`,
          bold: true,
          size: 24,
        }),
      ],
    }),
    new Paragraph({ text: "" })
  );

  // Summary
  if (data.summary) {
    children.push(
      new Paragraph({ children: [new TextRun({ text: data.summary, size: 22 })] }),
      new Paragraph({ text: "" })
    );
  }

  // Category summary table
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: "Category Summary", bold: true })],
    })
  );
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [headerCell("Category", 40), headerCell("NCC Volume", 20), headerCell("Findings", 15), headerCell("Status", 25)],
        }),
        ...categories.map((cat) => {
          const catFindings = data.findings.filter((f) => f.category === cat);
          const status = getCategoryStatus(catFindings);
          const statusLabel = status === "passed" ? "Pass" : status === "issues" ? "Advisory" : "Fail";
          return new TableRow({
            children: [
              cell(getCategoryLabel(cat)),
              cell(`Vol ${getCategoryVolume(cat)}`),
              cell(`${catFindings.length}`),
              cell(statusLabel, { bold: true, color: severityColor(statusLabel === "Fail" ? "Non-Compliant" : statusLabel === "Advisory" ? "Advisory" : "Compliant") }),
            ],
          });
        }),
      ],
    }),
    new Paragraph({ text: "" })
  );

  // Workflow summary (if findings have review_status)
  const hasWorkflow = data.findings.some((f) => f.review_status != null);
  if (hasWorkflow) {
    const counts = {
      pending: data.findings.filter((f) => f.review_status === "pending").length,
      accepted: data.findings.filter((f) => f.review_status === "accepted").length,
      amended: data.findings.filter((f) => f.review_status === "amended").length,
      rejected: data.findings.filter((f) => f.review_status === "rejected").length,
      sent: data.findings.filter((f) => f.review_status === "sent").length,
    };
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: "Workflow Summary", bold: true })],
      }),
      new Table({
        width: { size: 60, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: [headerCell("Status", 70), headerCell("Count", 30)] }),
          new TableRow({ children: [cell("Pending"), cell(`${counts.pending}`)] }),
          new TableRow({ children: [cell("Accepted"), cell(`${counts.accepted}`)] }),
          new TableRow({ children: [cell("Amended"), cell(`${counts.amended}`)] }),
          new TableRow({ children: [cell("Rejected"), cell(`${counts.rejected}`)] }),
          new TableRow({ children: [cell("Sent to Contributor"), cell(`${counts.sent}`)] }),
        ],
      }),
      new Paragraph({ text: "" })
    );
  }

  // Findings by category
  for (const category of categories) {
    const catFindings = data.findings.filter((f) => f.category === category);
    const label = getCategoryLabel(category);
    const volume = getCategoryVolume(category);

    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: `${label} (NCC Volume ${volume})`, bold: true })],
      })
    );
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              headerCell("NCC Section", 12),
              headerCell("Finding", 28),
              headerCell("Severity", 14),
              headerCell("Assigned To", 18),
              headerCell("Remediation Action", 28),
            ],
          }),
          ...catFindings.map((f) => {
            const sev = SEVERITY_LABELS[f.severity] ?? f.severity;
            return new TableRow({
              children: [
                cell(f.ncc_section),
                cell(f.title),
                cell(sev, { bold: sev === "Critical" || sev === "Non-Compliant", color: severityColor(sev) }),
                cell(getDisciplineLabel(f.responsible_discipline)),
                cell(f.remediation_action ?? f.recommendation ?? "-"),
              ],
            });
          }),
        ],
      }),
      new Paragraph({ text: "" })
    );
  }

  // NCC citations
  const cited = data.findings.filter((f) => f.ncc_citation);
  if (cited.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: "NCC Citations", bold: true })],
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: [headerCell("Section", 25), headerCell("Citation", 75)] }),
          ...cited.map((f) =>
            new TableRow({
              children: [cell(f.ncc_section), cell(f.ncc_citation ?? "")],
            })
          ),
        ],
      }),
      new Paragraph({ text: "" })
    );
  }

  // Disclaimer
  children.push(
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      children: [
        new TextRun({
          text:
            "DISCLAIMER: This is an AI-generated advisory report only. It does NOT constitute formal compliance certification. " +
            "All findings must be verified by a qualified building surveyor or certifier. MMC Build Pty Ltd accepts no liability " +
            "for reliance on this report without independent professional verification.",
          size: 16,
          color: "787878",
          italics: true,
        }),
      ],
    })
  );

  const doc = new Document({
    creator: "MMC Build",
    title: `MMC Compliance Report — ${data.projectName}`,
    description: "AI-generated NCC compliance advisory report",
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 22 } },
      },
    },
    sections: [
      {
        properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
        children,
      },
    ],
  });

  // Suppress unused-import warning for BorderStyle (kept for future use)
  void BorderStyle;

  return await Packer.toBuffer(doc);
}
