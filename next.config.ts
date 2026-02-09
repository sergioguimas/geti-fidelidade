import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
};

const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",       // Onde o service worker será gerado
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swcMinify: true,
  disable: process.env.NODE_ENV === "development", // Desabilita em dev para não atrapalhar
  workboxOptions: {
    disableDevLogs: true,
  },
});

export default withPWA(nextConfig);
