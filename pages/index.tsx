import dynamic from "next/dynamic";

export default function RemoveSSR() {
  const Home = dynamic(() => import("components/home"), { ssr: false });
  return <Home />;
}
