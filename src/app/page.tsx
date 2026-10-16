import { Experience } from "@/components/experience/Experience";
import { Chapters } from "@/components/flight/Chapters";

export default function Home() {
  return (
    <>
      <noscript>
        <style>{`.gate{display:none!important}html{overflow:auto!important}.beat,.shard-title{position:static!important;opacity:1!important;visibility:visible!important}`}</style>
      </noscript>
      <Experience />
      <Chapters />
    </>
  );
}
