import { NextResponse } from 'next/server';
import { adminDb } from '../../../../lib/firebaseAdmin';

/**
 * GET /api/admin/repair-inventory
 * Diagnostic: show all transactions and activity logs for comparison
 */
export async function GET() {
    try {
        const borrowSnap = await adminDb.collection('transactions')
            .where('type', '==', 'borrow').get();
        const returnSnap = await adminDb.collection('transactions')
            .where('type', '==', 'return').get();
        const activitySnap = await adminDb.collection('activities')
            .where('action', '==', 'return').get();

        const borrows = borrowSnap.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                productId: data.productId,
                productName: data.productName,
                borrowerName: data.borrowerName,
                userRoom: data.userRoom,
                borrowDate: data.borrowDate?.toDate?.()?.toISOString(),
                returnDate: data.returnDate?.toDate?.()?.toISOString(),
                status: data.status,
                returnedAt: data.returnedAt?.toDate?.()?.toISOString(),
            };
        });

        const returns = returnSnap.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                productId: data.productId,
                productName: data.productName,
                returnerName: data.returnerName,
                timestamp: data.timestamp?.toDate?.()?.toISOString(),
                status: data.status,
            };
        });

        const activities = activitySnap.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                action: data.action,
                productName: data.productName,
                userName: data.userName,
                timestamp: data.timestamp?.toDate?.()?.toISOString(),
                status: data.status,
            };
        });

        // Group by product
        const productMap = new Map<string, any>();
        for (const b of borrows) {
            if (!productMap.has(b.productId)) {
                productMap.set(b.productId, { productName: b.productName, borrows: [], returns: [], activities: [] });
            }
            productMap.get(b.productId).borrows.push(b);
        }
        for (const r of returns) {
            if (!productMap.has(r.productId)) {
                productMap.set(r.productId, { productName: r.productName, borrows: [], returns: [], activities: [] });
            }
            productMap.get(r.productId).returns.push(r);
        }

        // Match activities to products by name
        for (const a of activities) {
            // Find product by name
            const matchedPid = Array.from(productMap.entries()).find(([_, data]) =>
                data.productName === a.productName
            );
            if (matchedPid) {
                matchedPid[1].activities.push(a);
            }
        }

        const result: any = {};
        Array.from(productMap.entries()).forEach(([pid, data]) => {
            result[pid] = data;
        });

        // Also get products to show current state
        const productsSnap = await adminDb.collection('products').get();
        const productStates: any = {};
        for (const doc of productsSnap.docs) {
            const d = doc.data();
            if (d.borrowedCount || d.status === 'borrowed' || d.status === 'ไม่ว่าง' || result[doc.id]) {
                productStates[doc.id] = {
                    name: d.name,
                    type: d.type || 'unique',
                    status: d.status,
                    quantity: d.quantity,
                    borrowedCount: d.borrowedCount || 0,
                };
            }
        }

        return NextResponse.json({ products: result, productStates });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * PATCH /api/admin/repair-inventory
 * Explicit repair: delete products, update fields, fix transactions
 * Body: { deleteProducts: string[], updateProducts: {id, fields}[], fixTransactions: {id, fields}[] }
 */
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const results: any = { deleted: [], updated: [], fixedTransactions: [] };

        // Delete specific products
        for (const productId of (body.deleteProducts || [])) {
            await adminDb.collection('products').doc(productId).delete();
            results.deleted.push(productId);
        }

        // Update specific products
        for (const item of (body.updateProducts || [])) {
            await adminDb.collection('products').doc(item.id).update(item.fields);
            results.updated.push({ id: item.id, fields: item.fields });
        }

        // Fix specific transactions
        for (const item of (body.fixTransactions || [])) {
            await adminDb.collection('transactions').doc(item.id).update(item.fields);
            results.fixedTransactions.push({ id: item.id, fields: item.fields });
        }

        return NextResponse.json({ success: true, results });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

/**
 * POST /api/admin/repair-inventory
 * 
 * Repairs inconsistent borrow/return data:
 * 1. Uses ACTIVITY LOGS (reliable) to find returns that weren't reflected in transactions
 * 2. Marks matching borrow transactions as "completed"
 * 3. Recalculates borrowedCount for all products
 * 
 * DRY RUN: Pass ?dryRun=true to preview without making changes
 */
export async function POST(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const dryRun = searchParams.get('dryRun') === 'true';

        const results: any = {
            dryRun,
            transactionFixes: [],
            borrowCountFixes: [],
            errors: [],
        };

        // ====== STEP 1: Get all return ACTIVITIES, filter Feb 2026+ client-side ======
        const febStart = new Date('2026-02-01T00:00:00Z');
        const returnActivitiesSnap = await adminDb.collection('activities')
            .where('action', '==', 'return')
            .get();

        const returnActivities = returnActivitiesSnap.docs
            .map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    productName: data.productName,
                    userName: data.userName,
                    timestamp: data.timestamp?.toDate?.(),
                };
            })
            .filter(a => a.timestamp && a.timestamp >= febStart)
            .sort((a, b) => (a.timestamp?.getTime() || 0) - (b.timestamp?.getTime() || 0));

        // ====== STEP 2: Get all active borrow transactions ======
        const activeBorrowSnap = await adminDb.collection('transactions')
            .where('type', '==', 'borrow')
            .where('status', '==', 'active')
            .get();

        // Group active borrows by productName (since activities don't have productId)
        const activeBorrowsByName = new Map<string, any[]>();
        for (const doc of activeBorrowSnap.docs) {
            const data = doc.data();
            const name = data.productName;
            if (!activeBorrowsByName.has(name)) {
                activeBorrowsByName.set(name, []);
            }
            activeBorrowsByName.get(name)!.push({ id: doc.id, ...data });
        }

        // ====== STEP 3: Match return activities to active borrows ======
        for (const retAct of returnActivities) {
            const borrows = activeBorrowsByName.get(retAct.productName) || [];
            if (borrows.length === 0) continue;

            // Find best match: prefer matching borrowerName == userName from activity
            let matchIdx = borrows.findIndex((b: any) =>
                b.borrowerName && b.borrowerName.trim() === retAct.userName.trim()
            );

            // If no name match, take the oldest borrow (FIFO)
            if (matchIdx === -1) {
                borrows.sort((a: any, b: any) => {
                    const aDate = a.borrowDate?.toDate?.() ?? new Date(0);
                    const bDate = b.borrowDate?.toDate?.() ?? new Date(0);
                    return aDate.getTime() - bDate.getTime();
                });
                matchIdx = 0;
            }

            const matchedBorrow = borrows[matchIdx];

            results.transactionFixes.push({
                activityId: retAct.id,
                activityUser: retAct.userName,
                activityDate: retAct.timestamp?.toISOString(),
                productName: retAct.productName,
                matchedBorrowId: matchedBorrow.id,
                matchedBorrowerName: matchedBorrow.borrowerName,
                borrowDate: matchedBorrow.borrowDate?.toDate?.()?.toISOString(),
                matchType: matchIdx >= 0 && matchedBorrow.borrowerName?.trim() === retAct.userName.trim() ? 'name_match' : 'fifo',
            });

            if (!dryRun) {
                await adminDb.collection('transactions').doc(matchedBorrow.id).update({
                    status: 'completed',
                    returnedAt: retAct.timestamp || new Date(),
                    returnerName: retAct.userName,
                    repairedAt: new Date(),
                    repairNote: `Auto-repaired from activity log ${retAct.id} (${retAct.userName} on ${retAct.timestamp?.toISOString()})`,
                });
            }

            // Remove matched borrow from the pool
            borrows.splice(matchIdx, 1);
        }

        // ====== STEP 4: Recalculate borrowedCount for all products ======
        // Re-query active borrows after fixes
        const remainingActiveBorrowSnap = dryRun
            ? activeBorrowSnap
            : await adminDb.collection('transactions')
                .where('type', '==', 'borrow')
                .where('status', '==', 'active')
                .get();

        // Count actual active borrows per product
        const actualBorrowCounts = new Map<string, number>();
        const fixedIds = new Set(results.transactionFixes.map((r: any) => r.matchedBorrowId));

        for (const doc of remainingActiveBorrowSnap.docs) {
            if (dryRun && fixedIds.has(doc.id)) continue;
            const data = doc.data();
            const pid = data.productId;
            actualBorrowCounts.set(pid, (actualBorrowCounts.get(pid) || 0) + 1);
        }

        // Get all products and compare
        const productsSnap = await adminDb.collection('products').get();
        for (const productDoc of productsSnap.docs) {
            const product = productDoc.data();
            const currentBorrowed = product.borrowedCount || 0;
            const actualBorrowed = actualBorrowCounts.get(productDoc.id) || 0;

            if (currentBorrowed !== actualBorrowed) {
                results.borrowCountFixes.push({
                    productId: productDoc.id,
                    productName: product.name,
                    type: product.type || 'unique',
                    oldBorrowedCount: currentBorrowed,
                    newBorrowedCount: actualBorrowed,
                    quantity: product.quantity || 1,
                });

                if (!dryRun) {
                    const updateData: any = {
                        borrowedCount: actualBorrowed,
                        updatedAt: new Date(),
                    };

                    // For unique items: also fix status
                    if (product.type !== 'bulk') {
                        if (actualBorrowed > 0) {
                            updateData.status = 'borrowed';
                        } else if (product.status === 'borrowed' || product.status === 'ไม่ว่าง') {
                            updateData.status = 'available';
                            updateData.activeBorrowId = null;
                        }
                    }

                    await adminDb.collection('products').doc(productDoc.id).update(updateData);
                }
            }
        }

        return NextResponse.json({
            success: true,
            ...results,
            summary: {
                transactionsFixed: results.transactionFixes.length,
                borrowCountsFixed: results.borrowCountFixes.length,
                errors: results.errors.length,
            }
        });

    } catch (error: any) {
        console.error('Repair inventory error:', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
