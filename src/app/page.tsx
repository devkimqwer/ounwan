import { getOunwanAppData } from "@/db/queries";
import { OunwanApp } from "@/features/app/ounwan-app";

export const dynamic = "force-dynamic";

export default async function Home() {
  const appData = await getOunwanAppData();

  return <OunwanApp appData={appData} />;
}
