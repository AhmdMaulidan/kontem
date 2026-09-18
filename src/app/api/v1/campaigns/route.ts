import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { errorResponse, successResponse, ErrorCode } from "@/lib/api-response";
import { BusinessCategory } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  category: z
    .enum(["KULINER", "WISATA_ALAM", "WISATA_BUATAN", "AKOMODASI", "LAINNYA"])
    .optional(),
  search: z.string().trim().max(100).optional(),
  sortBy: z.enum(["newest", "budget", "cpm"]).default("newest"),
});

/**
 * Public REST API: Daftar Kampanye Aktif
 * GET /api/v1/campaigns?page=1&limit=10&category=KULINER&search=kopi&sortBy=newest
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = querySchema.safeParse(Object.fromEntries(searchParams.entries()));

    if (!parsed.success) {
      return errorResponse(
        ErrorCode.BAD_REQUEST,
        parsed.error.issues[0].message,
        400,
        parsed.error.flatten().fieldErrors,
      );
    }

    const { page, limit, category, search, sortBy } = parsed.data;
    const skip = (page - 1) * limit;

    // Filter hanya campaign aktif yang belum lewat batas waktu
    const whereClause: Record<string, unknown> = {
      status: "ACTIVE",
      endDate: { gte: new Date() },
    };

    if (category) {
      whereClause.category = category as BusinessCategory;
    }

    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { vendor: { vendorProfile: { businessName: { contains: search, mode: "insensitive" } } } },
        { vendor: { vendorProfile: { city: { contains: search, mode: "insensitive" } } } },
      ];
    }

    let orderBy: Record<string, "asc" | "desc"> = { createdAt: "desc" };
    if (sortBy === "budget") {
      orderBy = { budgetPool: "desc" };
    } else if (sortBy === "cpm") {
      orderBy = { cpmRate: "desc" };
    }

    const [total, campaigns] = await Promise.all([
      db.campaign.count({ where: whereClause }),
      db.campaign.findMany({
        where: whereClause,
        select: {
          id: true,
          title: true,
          category: true,
          description: true,
          budgetPool: true,
          cpmRate: true,
          maxViewsPerCreator: true,
          complimentType: true,
          complimentValue: true,
          allowedPlatforms: true,
          startDate: true,
          endDate: true,
          vendor: {
            select: {
              name: true,
              vendorProfile: {
                select: {
                  businessName: true,
                  city: true,
                  province: true,
                },
              },
            },
          },
          _count: {
            select: {
              participations: { where: { status: { not: "CANCELLED" } } },
            },
          },
        },
        skip,
        take: limit,
        orderBy,
      }),
    ]);

    const formatted = campaigns.map((c) => ({
      id: c.id,
      title: c.title,
      category: c.category,
      description: c.description,
      budgetPool: c.budgetPool,
      cpmRate: c.cpmRate,
      participantsCount: c._count.participations,
      compliment: {
        type: c.complimentType,
        value: c.complimentValue,
      },
      allowedPlatforms: c.allowedPlatforms,
      startDate: c.startDate.toISOString(),
      endDate: c.endDate.toISOString(),
      vendor: {
        businessName: c.vendor.vendorProfile?.businessName ?? c.vendor.name,
        city: c.vendor.vendorProfile?.city ?? "-",
        province: c.vendor.vendorProfile?.province ?? "-",
      },
    }));

    const totalPages = Math.ceil(total / limit);

    return successResponse(formatted, 200, {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    });
  } catch (error) {
    console.error("[GET /api/v1/campaigns Error]", error);
    return errorResponse(
      ErrorCode.INTERNAL_ERROR,
      "Gagal mengambil daftar kampanye aktif.",
      500,
    );
  }
}
