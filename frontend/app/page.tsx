import { HomeGeneratedMediaGallery } from "@/components/home-generated-media-gallery";
import {
  createApiClient,
  getUserFacingErrorMessage
} from "@/lib/api-client";
import type { Asset } from "@/lib/api-types";

export default async function Home() {
  const api = createApiClient();
  let assets: Asset[] = [];
  let error: string | undefined;

  try {
    const [projectAssets, toolAssets] = await Promise.all([
      api.listAssets({}, { next: { revalidate: 30 } }),
      api.listToolAssets({ next: { revalidate: 30 } })
    ]);
    assets = [...projectAssets, ...toolAssets];
  } catch (requestError) {
    error = getUserFacingErrorMessage(requestError);
  }

  return <HomeGeneratedMediaGallery assets={assets} error={error} />;
}
