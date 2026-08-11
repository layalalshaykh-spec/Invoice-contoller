import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const output = join(process.cwd(), "public", "mock-invoices");
await mkdir(output, { recursive: true });

function escapePdf(text) { return text.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)"); }
function pdf(lines) {
  const stream = ["BT", "/F1 16 Tf", "60 770 Td", ...lines.flatMap((line, i) => [i ? "0 -28 Td" : "", `(${escapePdf(line)}) Tj`]).filter(Boolean), "ET"].join("\n");
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>","<< /Type /Pages /Kids [3 0 R] /Count 1 >>","<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  let body = "%PDF-1.4\n", offsets=[0]; for(let i=0;i<objects.length;i++){offsets.push(body.length);body+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;} const xref=body.length; body+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,"0")+" 00000 n ").join("\n")}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`; return body;
}
for (let i=1;i<=34;i++) { const arabic=[8,19,30].includes(i); const name=`${arabic?"arabic":"invoice"}-${String(i).padStart(2,"0")}.pdf`; await writeFile(join(output,name),pdf(["AL RAYYAN TRADING & CONTRACTING","TAX INVOICE",`Invoice reference: AR-${260700+i}`,`Purchase order: PO-2026-${String(1040+(i%26)+1).padStart(5,"0")}`,`Document language: ${arabic?"Arabic / English":"English"}`,`Total due: QAR ${(8250+i*730).toLocaleString("en-US")}`,"Generated source document for AP control demonstration"])); }
console.log("Generated 34 mock invoice PDFs.");
