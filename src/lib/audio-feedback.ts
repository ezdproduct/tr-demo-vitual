// Web Audio API Synthesizer for high-quality camera and leveling sound effects.

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx && typeof window !== 'undefined') {
    // Standard audio context
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  return audioCtx!;
}

// Resume the audio context if suspended (browser security autoplay policies)
export async function resumeAudioContext(): Promise<void> {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    await ctx.resume();
  }
}

// Synthesize a high-quality electronic alignment "ping"
export function playAlignmentPing() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    
    // Resume context if needed
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;
    
    // Synthesizer setup
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    // Sweet sine chime
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now); // A5 note
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08); // Sweet upward fifth (E6)
    
    // Quick gain envelope: instant attack, rapid decay
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    
    osc.start(now);
    osc.stop(now + 0.15);
  } catch (error) {
    console.error('Failed to play alignment ping:', error);
  }
}

// Synthesize a mechanical camera shutter sound using synthesized noise and oscillator transients
export function playCameraShutter() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;
    
    // 1. Shutter "Click" (High frequency mechanical snap)
    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.connect(clickGain);
    clickGain.connect(ctx.destination);
    
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(1000, now);
    clickOsc.frequency.linearRampToValueAtTime(100, now + 0.05);
    
    clickGain.gain.setValueAtTime(0.12, now);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    
    clickOsc.start(now);
    clickOsc.stop(now + 0.07);

    // 2. Shutter "Whir/Swoosh" (Filtered white noise to simulate physical shutter curtains)
    const bufferSize = ctx.sampleRate * 0.08; // 80ms duration
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    // Fill buffer with random noise
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = buffer;
    
    // Filter to make the noise sound mechanical (metallic/airy)
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2000, now);
    filter.Q.setValueAtTime(3, now);
    
    const noiseGain = ctx.createGain();
    
    noiseSource.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    
    // Noise envelope: starts slightly after initial click, decays rapidly
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(0.08, now + 0.01);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    
    noiseSource.start(now);
    noiseSource.stop(now + 0.09);
    
    // 3. Shutter "Thump" (Low-frequency reflex mirror slap)
    const thumpOsc = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thumpOsc.connect(thumpGain);
    thumpGain.connect(ctx.destination);
    
    thumpOsc.type = 'sine';
    thumpOsc.frequency.setValueAtTime(80, now);
    thumpOsc.frequency.exponentialRampToValueAtTime(20, now + 0.08);
    
    thumpGain.gain.setValueAtTime(0.2, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
    
    thumpOsc.start(now);
    thumpOsc.stop(now + 0.12);
  } catch (error) {
    console.error('Failed to play camera shutter sound:', error);
  }
}
