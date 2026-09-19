import { notFound } from "next/navigation";
import { MatchDetail } from "@/components/flow/match/MatchDetail";
import { getListingById, mockListings } from "@/lib/flow/mock-listings";

interface ExploreDetailPageProps {
  params: Promise<{ id: string }>;
}

export const generateStaticParams = () =>
  mockListings.map((listing) => ({ id: listing.id }));

const ExploreDetailPage = async ({ params }: ExploreDetailPageProps) => {
  const { id } = await params;
  const listing = getListingById(id);

  if (!listing) notFound();

  return <MatchDetail listing={listing} />;
};

export default ExploreDetailPage;
