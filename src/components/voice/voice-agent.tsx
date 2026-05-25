"use client";

import Script from "next/script";
import { createElement } from "react";

/**
 * Persistent voice agent for the authenticated app chrome (portfolio VOICE AI
 * STANDARD: reachable from the chrome on every signed-in surface).
 *
 * Uses the ElevenLabs ConvAI embeddable widget via its CDN script + custom
 * element. `createElement` avoids custom-element JSX typing friction.
 *
 * The agent id is env-driven so it can be swapped without a code change. The
 * fallback below is a TEMPORARY stand-in agent ("methodology / rehearsals-ai /
 * distributor-candidate") — set NEXT_PUBLIC_ELEVENLABS_AGENT_ID to a dedicated
 * MMC Build agent for production.
 */
const AGENT_ID =
  process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID ??
  "agent_8401ksadmdx1f1arf6xeq5spk2qf";

export function VoiceAgent() {
  return (
    <>
      <Script
        src="https://elevenlabs.io/convai-widget/index.js"
        strategy="afterInteractive"
      />
      {createElement("elevenlabs-convai", { "agent-id": AGENT_ID })}
    </>
  );
}
