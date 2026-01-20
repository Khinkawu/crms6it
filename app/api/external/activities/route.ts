import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/firebaseAdmin";
import { PhotographyJob } from "../../../../types";

// Revalidate every 60 seconds (ISR-like behavior for API)
export const revalidate = 60;

export async function GET(request: Request) {
    try {
        console.log("[API] External Activities: Fetching confirmed jobs...");

        // Query: Completed jobs, ordered by endTime (latest first)
        // Note: Firestore requires an index for 'status' + 'endTime'. 
        // If it looks missing, we might need to create it.
        // For safety/easier query without complex index params, we can query by status and sort in memory if the dataset is smallish, 
        // OR just try the compound query. 
        // Let's try the proper compound query first.
        const snapshot = await adminDb
            .collection("photography_jobs")
            .where("status", "==", "completed")
            .orderBy("endTime", "desc")
            .limit(20) // Fetch slightly more to filter for facebook links
            .get();

        if (snapshot.empty) {
            return NextResponse.json({ success: true, data: [] });
        }

        const activities: any[] = [];

        snapshot.forEach((doc) => {
            const data = doc.data() as PhotographyJob;

            // Filter: Must have a Facebook Link (Permalink or Post ID that implies a link)
            // We prioritize facebookPermalink.
            if (!data.facebookPermalink && !data.facebookPostId) {
                return;
            }

            // Construct Link
            let fbLink = data.facebookPermalink;
            if (!fbLink && data.facebookPostId) {
                // Fallback construction if only ID exists (assumes page ID context, might be tricky, so prefer permalink)
                // But usually we save permalink. If not, we skip.
                // Or if we know the page ID, we could construct it. 
                // Let's strictly require permalink OR valid url in facebookPostId (some legacy might store url there?)
                // Actually, let's just check if 'facebookPermalink' is valid URL or 'driveLink' as fallback?
                // User specifically asked for "facebook post link".
                return;
            }

            // Format Output for External Consumption
            activities.push({
                id: doc.id,
                title: data.title,
                // Use cover image if available, else first image from stats? 
                // PhotographyReport might be separate. 
                // In "photography_jobs", we might not have the 'images' array directly if it's just a job ticket.
                // We usually rely on 'coverImage' field if we added one (we added it to type definition recently).
                // Or we look at 'driveLink' / 'attachments'?
                // Let's check type definition: `coverImage?: string;` exists.
                coverImage: data.coverImage || "https://placehold.co/600x400?text=No+Image",
                facebookLink: fbLink,
                date: data.endTime ? data.endTime.toDate().toISOString() : new Date().toISOString(),
                location: data.location || "",
                description: data.facebookCaption || "" // Strictly Facebook Caption only
            });
        });

        // Limit to top 6 for the widget
        const result = activities.slice(0, 6);

        // Add CORS headers to allow School Website (any domain or specific) to fetch
        return NextResponse.json(
            { success: true, data: result },
            {
                headers: {
                    "Access-Control-Allow-Origin": "*", // Allow all for public consumption
                    "Access-Control-Allow-Methods": "GET, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization",
                    "Cache-Control": "s-maxage=60, stale-while-revalidate=300"
                },
            }
        );

    } catch (error: any) {
        console.error("[API] External Activities Error:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
    return NextResponse.json({}, {
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
    });
}
