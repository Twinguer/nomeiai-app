import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const REACT_CORE_PACKAGES = new Set([
  "react",
  "react-dom",
  "scheduler",
  "object-assign",
  "loose-envify",
]);

/**
 * Camada compartilhada de rankings/resultados — usada por perfil, admin, resultados e rankings.
 * Feature chunks manuais foram removidos: geravam ciclos Rollup e pouco isolamento real
 * (App importa tudo estaticamente). Chunks de rota vêm de React.lazy() no App.tsx.
 */
function isSharedRankingLayer(normalizedId: string): boolean {
  return (
    normalizedId.includes("/src/modules/rankings/services/rankingService") ||
    normalizedId.includes("/src/modules/rankings/services/rankingCache") ||
    normalizedId.includes("/src/services/concursoService") ||
    normalizedId.includes("/src/integrations/supabase/rankings/") ||
    normalizedId.includes("/src/modules/rankings/hooks/useResultadosData") ||
    normalizedId.includes("/src/hooks/useAnswerSheet") ||
    normalizedId.includes("/src/modules/rankings/hooks/useSaveAnswers") ||
    normalizedId.includes("/src/modules/rankings/hooks/useLeaveRanking") ||
    normalizedId.includes("/src/utils/consolidatedDataMapper") ||
    normalizedId.includes("/src/modules/rankings/components/classification/LoadingState") ||
    normalizedId.includes("/src/components/Admin/NullifyQuestionButton")
  );
}

function resolveManualChunk(id: string): string | undefined {
  const normalizedId = id.replace(/\\/g, "/");
  const pkgMatch = normalizedId.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/);
  const pkgName = pkgMatch?.[1];

  if (pkgName && REACT_CORE_PACKAGES.has(pkgName)) {
    return "react-vendor";
  }

  if (normalizedId.includes("node_modules")) {
    if (
      normalizedId.includes("/react/") &&
      !normalizedId.includes("/react-dom/") &&
      !normalizedId.includes("/react-router") &&
      !normalizedId.includes("/react-hook-form") &&
      !normalizedId.includes("/react-query") &&
      !normalizedId.includes("/@tanstack/react-query")
    ) {
      if (
        pkgName === "react" ||
        pkgName === "react-dom" ||
        pkgName === "scheduler" ||
        pkgName === "object-assign" ||
        pkgName === "loose-envify"
      ) {
        return "react-vendor";
      }
    }
    return "vendor";
  }

  if (isSharedRankingLayer(normalizedId)) {
    return "shared-ranking";
  }

  return undefined;
}

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  build: {
    target: "esnext",
    minify: "esbuild",
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      external: ["ioredis"],
      output: {
        chunkFileNames: (chunkInfo) => {
          if (chunkInfo.name === "react-vendor") {
            return "assets/react-vendor-[hash].js";
          }
          return "assets/[name]-[hash].js";
        },
        manualChunks: (id) => resolveManualChunk(id),
      },
    },
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "@radix-ui/react-dialog",
      "@radix-ui/react-slot",
      "@radix-ui/react-toast",
      "lucide-react",
      "sonner",
    ],
  },
}));
