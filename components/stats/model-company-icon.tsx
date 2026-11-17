import { Box } from "lucide-react";
import * as CompanyIcons from "@/components/icons/companyIcons";

const COMPANIES = [
  { name: "Anthropic", icon: CompanyIcons.ClaudeIcon, keywords: ["anthropic", "claude"] },
  {
    name: "OpenAI",
    icon: CompanyIcons.OpenAIIcon,
    keywords: ["openai", "gpt", "chatgpt", "text-embedding"],
  },
  { name: "DeepSeek", icon: CompanyIcons.DeepSeekIcon, keywords: ["deepseek"] },
  { name: "Z.ai", icon: CompanyIcons.ZAIIcon, keywords: ["zhipu", "glm", "z-ai", "z ai"] },
  { name: "Moonshot", icon: CompanyIcons.KimiIcon, keywords: ["moonshot", "kimi"] },
  { name: "MiniMax", icon: CompanyIcons.MinimaxIcon, keywords: ["minimax"] },
  {
    name: "Google",
    icon: CompanyIcons.GeminiIcon,
    keywords: ["google", "gemini", "gemma", "nano banana", "nano-banana", "lyria"],
  },
  { name: "Alibaba", icon: CompanyIcons.QwenIcon, keywords: ["alibaba", "qwen", "qwq", "wan"] },
  { name: "xAI", icon: CompanyIcons.GrokIcon, keywords: ["xai", "x-ai", "x ai", "grok"] },
  { name: "Perplexity", icon: CompanyIcons.PerplexityIcon, keywords: ["perplexity", "sonar", "pplx"] },
  {
    name: "Mistral",
    icon: CompanyIcons.MistralIcon,
    keywords: ["mistral", "mixtral", "codestral", "ministral", "voxtral"],
  },
  { name: "Meta", icon: CompanyIcons.MetaIcon, keywords: ["meta", "llama"] },
  { name: "Cohere", icon: CompanyIcons.CohereIcon, keywords: ["cohere", "command"] },
  { name: "NVIDIA", icon: CompanyIcons.NvidiaIcon, keywords: ["nvidia", "nemotron"] },
  { name: "Amazon", icon: CompanyIcons.AwsIcon, keywords: ["amazon", "nova"] },
  { name: "Xiaomi", icon: CompanyIcons.XiaomiMiMoIcon, keywords: ["xiaomi", "mimo"] },
  { name: "StepFun", icon: CompanyIcons.StepfunIcon, keywords: ["stepfun"] },
  { name: "Venice", icon: CompanyIcons.VeniceIcon, keywords: ["venice"] },
  { name: "ByteDance", icon: CompanyIcons.ByteDanceIcon, keywords: ["bytedance", "seedream", "seedance", "doubao"] },
  { name: "Recraft", icon: CompanyIcons.RecraftIcon, keywords: ["recraft"] },
  { name: "Black Forest Labs", icon: CompanyIcons.FluxIcon, keywords: ["black-forest", "flux"] },
  { name: "Tencent", icon: CompanyIcons.TencentIcon, keywords: ["tencent", "hunyuan"] },
  { name: "Krea", icon: CompanyIcons.KreaIcon, keywords: ["krea"] },
  { name: "Voyage", icon: CompanyIcons.VoyageIcon, keywords: ["voyage"] },
  { name: "Luma", icon: CompanyIcons.LumaIcon, keywords: ["luma"] },
  { name: "Liquid", icon: CompanyIcons.LiquidIcon, keywords: ["liquid", "lfm"] },
  { name: "Ideogram", icon: CompanyIcons.IdeogramIcon, keywords: ["ideogram"] },
  { name: "BAAI", icon: CompanyIcons.BaaiIcon, keywords: ["baai", "bge-"] },
] as const;

const GENERIC_PROVIDER_IDS = new Set(["model", "models", "unknown"]);

/** The company whose name, or whose model family, is in this text. */
export function companyIn(text: string) {
  const haystack = text.toLowerCase();
  return COMPANIES.find(({ keywords }) =>
    keywords.some((keyword) => haystack.includes(keyword))
  );
}

export function ModelCompanyIcon({
  model,
  provider,
  className,
}: {
  model: string;
  provider?: string;
  className?: string;
}) {
  const modelProvider = model.includes("/") ? model.split("/", 1)[0] : "";
  const providerId = (provider || modelProvider).trim().toLowerCase();
  const hasSpecificProvider =
    providerId.length > 0 && !GENERIC_PROVIDER_IDS.has(providerId);
  const Icon = companyIn(hasSpecificProvider ? providerId : model)?.icon;

  if (!Icon) {
    return <Box aria-hidden="true" className={className} />;
  }

  return <Icon aria-hidden="true" className={className} size="1em" />;
}
