import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const type = formData.get("type") as string; // "image" or "metadata"

    if (!file && type !== "metadata") {
      return NextResponse.json(
        { error: "File is required for image upload" },
        { status: 400 }
      );
    }

    // Try multiple possible env var names
    const pinataJwt = process.env.PINATA_JWT || process.env.NEXT_PUBLIC_PINATA_JWT;
    if (!pinataJwt) {
      console.error("Pinata JWT not found. Available env vars:", {
        hasPINATA_JWT: !!process.env.PINATA_JWT,
        hasNEXT_PUBLIC_PINATA_JWT: !!process.env.NEXT_PUBLIC_PINATA_JWT,
        allEnvKeys: Object.keys(process.env).filter(k => k.includes('PINATA'))
      });
      return NextResponse.json(
        { error: "Pinata JWT not configured. Please set PINATA_JWT in your .env.local file and restart the dev server." },
        { status: 500 }
      );
    }

    if (type === "image" && file) {
      // Upload image to Pinata
      const uploadFormData = new FormData();
      uploadFormData.append("file", file);

      const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${pinataJwt}`,
        },
        body: uploadFormData,
      });

      if (!response.ok) {
        const error = await response.text();
        return NextResponse.json(
          { error: `Failed to upload image: ${error}` },
          { status: response.status }
        );
      }

      const data = await response.json();
      return NextResponse.json({
        url: `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`,
      });
    } else if (type === "metadata") {
      // Upload metadata JSON to Pinata
      const metadata = JSON.parse(formData.get("metadata") as string);

      const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${pinataJwt}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(metadata),
      });

      if (!response.ok) {
        const error = await response.text();
        return NextResponse.json(
          { error: `Failed to upload metadata: ${error}` },
          { status: response.status }
        );
      }

      const data = await response.json();
      return NextResponse.json({
        url: `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`,
      });
    } else {
      return NextResponse.json(
        { error: "Invalid type. Must be 'image' or 'metadata'" },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error("Pinata upload error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to upload to Pinata" },
      { status: 500 }
    );
  }
}

