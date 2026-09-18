import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { errorResponse, successResponse, ErrorCode } from "@/lib/api-response";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Public REST API: Detail Kampanye Berdasarkan ID
 * GET /api/v1/campaigns/:id
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!id || typeof id !== "string" || id.trim().length === 0) {
      return errorResponse(ErrorCode.BAD_REQUEST, "Parameter ID campaign tidak valid.", 400);
    }

    const campaign = await db.campaign.findUnique({
      where: { id },
      include: {
        vendor: {
          select: {
            name: true,
            vendorProfile: {
              select: {
                businessName: true,
                address: true,
                city: true,
                province: true,
                latitude: true,
                longitude: true,
                category: true,
              },
            },
          },
        },
        _count: {
          select: {
            participations: { where: { status: { not: "CANCELLED" } } },
            submissions: { where: { status: "APPROVED" } },
          },
        },
      },
    });

    if (!campaign) {
      return errorResponse(
        ErrorCode.NOT_FOUND,
        `Campaign dengan ID "${id}" tidak ditemukan.`,
        404,
      );
    }

    const isLive = campaign.status === "ACTIVE" && new Date() <= campaign.endDate;

    const data = {
      id: campaign.id,
      title: campaign.title,
      category: campaign.category,
      description: campaign.description,
      status: campaign.status,
      isLive,
      brief: {
        angle: campaign.briefAngle,
        mustShow: campaign.briefMustShow,
        prohibited: campaign.briefProhibited,
        minDurationSec: campaign.minDurationSec,
      },
      economics: {
        budgetPool: campaign.budgetPool,
        cpmRate: campaign.cpmRate,
        maxCreators: campaign.maxCreators,
        maxViewsPerCreator: campaign.maxViewsPerCreator,
        filledSlots: campaign._count.participations,
        remainingSlots: Math.max(0, campaign.maxCreators - campaign._count.participations),
        approvedSubmissions: campaign._count.submissions,
      },
      compliment: {
        type: campaign.complimentType,
        value: campaign.complimentValue,
        terms: campaign.complimentTerms,
      },
      allowedPlatforms: campaign.allowedPlatforms,
      timeline: {
        startDate: campaign.startDate.toISOString(),
        endDate: campaign.endDate.toISOString(),
        trackingEndsAt: campaign.trackingEndsAt ? campaign.trackingEndsAt.toISOString() : null,
      },
      vendor: {
        businessName: campaign.vendor.vendorProfile?.businessName ?? campaign.vendor.name,
        address: campaign.vendor.vendorProfile?.address ?? "-",
        city: campaign.vendor.vendorProfile?.city ?? "-",
        province: campaign.vendor.vendorProfile?.province ?? "-",
        coordinates: {
          latitude: campaign.vendor.vendorProfile?.latitude ?? null,
          longitude: campaign.vendor.vendorProfile?.longitude ?? null,
        },
      },
    };

    return successResponse(data, 200);
  } catch (error) {
    console.error("[GET /api/v1/campaigns/:id Error]", error);
    return errorResponse(
      ErrorCode.INTERNAL_ERROR,
      "Terjadi kesalahan saat mengambil detail campaign.",
      500,
    );
  }
}
