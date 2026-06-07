import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import type { Lead } from "@/types";

const resend = new Resend(process.env.RESEND_API_KEY);

async function readLeads(): Promise<Lead[]> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const filePath = path.join(process.cwd(), "data", "leads.json");
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  if (process.env.ADMIN_SECRET && key !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const leads = await readLeads();
  return NextResponse.json(leads);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const lead: Lead = {
      name: String(body.name ?? "").trim(),
      phone: String(body.phone ?? "").trim(),
      email: body.email ? String(body.email).trim() : undefined,
      destination: body.destination ? String(body.destination).trim() : undefined,
      package: body.package ? String(body.package).trim() : undefined,
      budget: body.budget ? String(body.budget).trim() : undefined,
      dates: body.dates ? String(body.dates).trim() : undefined,
      travelers: body.travelers ? String(body.travelers).trim() : undefined,
      message: body.message ? String(body.message).trim() : undefined,
      sourcePage: String(body.sourcePage ?? "unknown").trim(),
      timestamp: new Date().toISOString(),
    };

    if (!lead.name || !lead.phone) {
      return NextResponse.json(
        { error: "Name and phone are required" },
        { status: 400 }
      );
    }

    if (process.env.RESEND_API_KEY) {
      const rows = [
        ["Name", lead.name],
        ["Phone", lead.phone],
        lead.email ? ["Email", lead.email] : null,
        lead.destination ? ["Destination", lead.destination] : null,
        lead.package ? ["Package", lead.package] : null,
        lead.travelers ? ["Travelers", lead.travelers] : null,
        lead.dates ? ["Dates", lead.dates] : null,
        lead.budget ? ["Budget", lead.budget] : null,
        lead.message ? ["Message", lead.message] : null,
        ["Source", lead.sourcePage],
        ["Time", lead.timestamp],
      ]
        .filter(Boolean)
        .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;font-weight:600;white-space:nowrap">${k}</td><td style="padding:4px 0">${v}</td></tr>`)
        .join("");

      await resend.emails.send({
        from: "Sarerah Travel <leads@sarerah.com>",
        to: "sarerah.travel@gmail.com",
        subject: `New lead from ${lead.sourcePage} — ${lead.name}`,
        html: `<table style="font-family:sans-serif;font-size:15px;color:#1c1917">${rows}</table>`,
      });
    }

    if (process.env.NODE_ENV === "development") {
      const fs = await import("fs/promises");
      const path = await import("path");
      const filePath = path.join(process.cwd(), "data", "leads.json");
      let leads: Lead[] = [];
      try {
        const data = await fs.readFile(filePath, "utf-8");
        leads = JSON.parse(data);
      } catch {
        await fs.mkdir(path.dirname(filePath), { recursive: true }).catch(() => {});
      }
      leads.push(lead);
      await fs.writeFile(filePath, JSON.stringify(leads, null, 2));
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Leads API error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
