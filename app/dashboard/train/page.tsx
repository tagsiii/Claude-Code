import type { Metadata, Viewport } from "next";
import { Anton, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import TrainApp from "./TrainApp";
import "./train.css";

const anton = Anton({ weight: "400", subsets: ["latin"], variable: "--tt-display" });
const plexSans = IBM_Plex_Sans({ weight: ["400", "500", "600", "700"], subsets: ["latin"], variable: "--tt-body" });
const plexMono = IBM_Plex_Mono({ weight: ["500", "600", "700"], subsets: ["latin"], variable: "--tt-mono" });

export const metadata: Metadata = {
  title: "Training & Fuel — Trey",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#16150f",
};

export default function TrainPage() {
  return (
    <div className={`tt ${anton.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <TrainApp />
    </div>
  );
}
