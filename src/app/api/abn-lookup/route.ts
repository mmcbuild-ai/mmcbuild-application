import { NextRequest, NextResponse } from "next/server";

const ABR_GUID = process.env.ABR_GUID || "";

function stripJsonp(text: string): string {
  return text.replace(/^cb\(/, "").replace(/\)$/, "");
}

export async function GET(req: NextRequest) {
  if (!ABR_GUID) {
    return NextResponse.json(
      { error: "ABR_GUID not configured" },
      { status: 500 }
    );
  }

  const name = req.nextUrl.searchParams.get("name")?.trim();
  const abn = req.nextUrl.searchParams.get("abn")?.replace(/\s/g, "");

  if (name && name.length >= 2) {
    try {
      const url = `https://abr.business.gov.au/json/MatchingNames.aspx?name=${encodeURIComponent(name)}&maxResults=8&callback=cb&guid=${ABR_GUID}`;
      const res = await fetch(url, { next: { revalidate: 3600 } });
      const text = await res.text();
      const data = JSON.parse(stripJsonp(text));

      if (!data.Names || data.Names.length === 0) {
        return NextResponse.json({ results: [] });
      }

      const results = data.Names.map(
        (n: { Abn: string; Name: string; NameType: string; State: string; Postcode: string; Score: number; IsCurrent: boolean }) => ({
          abn: n.Abn, name: n.Name, nameType: n.NameType, state: n.State,
          postcode: n.Postcode, score: n.Score, isCurrent: n.IsCurrent,
        })
      );
      return NextResponse.json({ results });
    } catch {
      return NextResponse.json({ error: "Name search failed" }, { status: 500 });
    }
  }

  if (abn && /^\d{11}$/.test(abn)) {
    try {
      const url = `https://abr.business.gov.au/json/AbnDetails.aspx?abn=${abn}&callback=cb&guid=${ABR_GUID}`;
      const res = await fetch(url, { next: { revalidate: 86400 } });
      const text = await res.text();
      const data = JSON.parse(stripJsonp(text));

      if (data.Message && !data.Abn) {
        return NextResponse.json({ error: data.Message }, { status: 404 });
      }
      if (!data.Abn) {
        return NextResponse.json({ error: "ABN not found" }, { status: 404 });
      }

      const businessNames: string[] = [];
      if (Array.isArray(data.BusinessName)) {
        for (const b of data.BusinessName) {
          if (typeof b === "string" && b) businessNames.push(b);
          else if (b?.organisationName) businessNames.push(b.organisationName);
        }
      }

      return NextResponse.json({
        abn: data.Abn, abnStatus: data.AbnStatus || "", entityName: data.EntityName || "",
        entityType: data.EntityTypeName || "", acn: data.Acn || "", businessNames,
        state: data.AddressState || "", postcode: data.AddressPostcode || "",
      });
    } catch {
      return NextResponse.json({ error: "Failed to look up ABN" }, { status: 500 });
    }
  }

  return NextResponse.json(
    { error: "Provide ?name=company+name or ?abn=12345678901" },
    { status: 400 }
  );
}
