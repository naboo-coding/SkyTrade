import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const type = formData.get("type") as string; // Either "image" or "metadata"

    if (!file && type !== "metadata") {
      return NextResponse.json(
        { error: "File is required for image upload" },
        { status: 400 }
      );
    }

    // Try different env var names in case someone used a different one
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
      // Upload the image to Pinata
      const uploadFormData = new FormData();
      uploadFormData.append("file", file);

      try {
        const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${pinataJwt}`,
          },
          body: uploadFormData,
        });

        if (!response.ok) {
          let errorMessage = "Failed to upload image";
          try {
            const error = await response.text();
            errorMessage = error || errorMessage;
          } catch (textError) {
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }
          return NextResponse.json(
            { error: `Failed to upload image: ${errorMessage}` },
            { status: response.status }
          );
        }

        const data = await response.json();
        return NextResponse.json({
          url: `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`,
        });
      } catch (fetchError: any) {
        console.error("Pinata fetch error (image):", fetchError);
        return NextResponse.json(
          { error: `Network error uploading image: ${fetchError.message || "Failed to connect to Pinata"}` },
          { status: 500 }
        );
      }
    } else if (type === "metadata") {
      // Upload the metadata JSON to Pinata
      let metadata;
      try {
        const metadataString = formData.get("metadata") as string;
        if (!metadataString) {
          console.error("❌ Metadata string is missing");
          return NextResponse.json(
            { error: "Metadata is required" },
            { status: 400 }
          );
        }
        console.log("📋 Parsing metadata string, length:", metadataString.length);
        metadata = JSON.parse(metadataString);
        console.log("✅ Metadata parsed successfully:", { name: metadata.name, symbol: metadata.symbol });
      } catch (parseError: any) {
        console.error("❌ Failed to parse metadata JSON:", parseError);
        return NextResponse.json(
          { error: `Invalid metadata JSON: ${parseError.message}` },
          { status: 400 }
        );
      }

      // Add a timeout to the fetch request so it doesn't hang forever
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      try {
        console.log("📤 Uploading metadata to Pinata...");
        const pinataUrl = "https://api.pinata.cloud/pinning/pinJSONToIPFS";
        console.log("🔗 Pinata URL:", pinataUrl);
        console.log("🔑 Has JWT:", !!pinataJwt);
        
        const response = await fetch(pinataUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${pinataJwt}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(metadata),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        console.log("📥 Pinata response:", {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
        });

        if (!response.ok) {
          let errorMessage = "Failed to upload metadata";
          try {
            const error = await response.text();
            errorMessage = error || errorMessage;
            console.error("❌ Pinata error response:", error);
          } catch (textError) {
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            console.error("❌ Could not read Pinata error response:", textError);
          }
          return NextResponse.json(
            { error: `Failed to upload metadata: ${errorMessage}` },
            { status: response.status }
          );
        }

        const data = await response.json();
        console.log("✅ Metadata uploaded successfully, IPFS hash:", data.IpfsHash);
        return NextResponse.json({
          url: `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`,
        });
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        console.error("❌ Pinata fetch error (metadata):", {
          name: fetchError?.name,
          message: fetchError?.message,
          stack: fetchError?.stack,
          cause: fetchError?.cause,
        });
        
        // Check if the request timed out
        if (fetchError?.name === "AbortError" || fetchError?.message?.includes("aborted")) {
          return NextResponse.json(
            { error: "Upload timeout: Pinata API did not respond within 30 seconds. Please try again." },
            { status: 504 }
          );
        }
        
        // Check if it's a network connectivity issue
        if (fetchError instanceof TypeError || fetchError?.message?.includes("fetch")) {
          return NextResponse.json(
            { error: `Network error: Unable to connect to Pinata API. ${fetchError.message || "Please check your internet connection."}` },
            { status: 503 }
          );
        }
        
        return NextResponse.json(
          { error: `Network error uploading metadata: ${fetchError?.message || "Failed to connect to Pinata"}` },
          { status: 500 }
        );
      }
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

