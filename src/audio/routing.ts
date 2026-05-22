import type { MonitoringMode } from '../types/audio'

export interface MonitoringChain {
  input: AudioNode
  output: AudioNode
  nodes: AudioNode[]
  cleanup: () => void
}

export function buildMonitoringChain(ctx: AudioContext, mode: MonitoringMode): MonitoringChain {
  const nodes: AudioNode[] = []

  function make<T extends AudioNode>(n: T): T {
    nodes.push(n)
    return n
  }

  switch (mode) {
    case 'stereo': {
      const g = make(ctx.createGain())
      return { input: g, output: g, nodes, cleanup: () => nodes.forEach(n => { try { n.disconnect() } catch { /**/ } }) }
    }

    case 'mono': {
      const split = make(ctx.createChannelSplitter(2))
      const monoG = make(ctx.createGain())
      monoG.gain.value = 0.5
      const merge = make(ctx.createChannelMerger(2))
      split.connect(monoG, 0)
      split.connect(monoG, 1)
      monoG.connect(merge, 0, 0)
      monoG.connect(merge, 0, 1)
      return { input: split, output: merge, nodes, cleanup: () => nodes.forEach(n => { try { n.disconnect() } catch { /**/ } }) }
    }

    case 'left': {
      const split = make(ctx.createChannelSplitter(2))
      const merge = make(ctx.createChannelMerger(2))
      split.connect(merge, 0, 0)
      split.connect(merge, 0, 1)
      return { input: split, output: merge, nodes, cleanup: () => nodes.forEach(n => { try { n.disconnect() } catch { /**/ } }) }
    }

    case 'right': {
      const split = make(ctx.createChannelSplitter(2))
      const merge = make(ctx.createChannelMerger(2))
      split.connect(merge, 1, 0)
      split.connect(merge, 1, 1)
      return { input: split, output: merge, nodes, cleanup: () => nodes.forEach(n => { try { n.disconnect() } catch { /**/ } }) }
    }

    case 'mid': {
      const split = make(ctx.createChannelSplitter(2))
      const midG = make(ctx.createGain())
      midG.gain.value = 0.7071
      const merge = make(ctx.createChannelMerger(2))
      split.connect(midG, 0)
      split.connect(midG, 1)
      midG.connect(merge, 0, 0)
      midG.connect(merge, 0, 1)
      return { input: split, output: merge, nodes, cleanup: () => nodes.forEach(n => { try { n.disconnect() } catch { /**/ } }) }
    }

    case 'side': {
      // Compute (L − R) × 0.7071 on both output channels using native nodes only.
      // ChannelSplitter feeds L→gainL(+0.7071) and R→gainR(−0.7071).
      // Both gains connect to the same ChannelMerger input for each output
      // channel so they sum: left_out = right_out = L×0.7071 + R×(−0.7071).
      const splitIn = make(ctx.createChannelSplitter(2))
      const gainL   = make(ctx.createGain()); gainL.gain.value =  0.7071
      const gainR   = make(ctx.createGain()); gainR.gain.value = -0.7071
      const merge   = make(ctx.createChannelMerger(2))
      splitIn.connect(gainL, 0)
      splitIn.connect(gainR, 1)
      gainL.connect(merge, 0, 0)
      gainR.connect(merge, 0, 0)
      gainL.connect(merge, 0, 1)
      gainR.connect(merge, 0, 1)
      return { input: splitIn, output: merge, nodes, cleanup: () => nodes.forEach(n => { try { n.disconnect() } catch { /**/ } }) }
    }

    case 'lowpass': {
      const f = make(ctx.createBiquadFilter())
      f.type = 'lowpass'; f.frequency.value = 300; f.Q.value = 0.7
      return { input: f, output: f, nodes, cleanup: () => nodes.forEach(n => { try { n.disconnect() } catch { /**/ } }) }
    }

    case 'highpass': {
      const f = make(ctx.createBiquadFilter())
      f.type = 'highpass'; f.frequency.value = 3000; f.Q.value = 0.7
      return { input: f, output: f, nodes, cleanup: () => nodes.forEach(n => { try { n.disconnect() } catch { /**/ } }) }
    }

    case 'phone': {
      const hpf = make(ctx.createBiquadFilter())
      hpf.type = 'highpass'; hpf.frequency.value = 300; hpf.Q.value = 0.8
      const lpf = make(ctx.createBiquadFilter())
      lpf.type = 'lowpass'; lpf.frequency.value = 3400; lpf.Q.value = 0.8
      const g = make(ctx.createGain()); g.gain.value = 1.4
      hpf.connect(lpf); lpf.connect(g)
      return { input: hpf, output: g, nodes, cleanup: () => nodes.forEach(n => { try { n.disconnect() } catch { /**/ } }) }
    }

    case 'car': {
      const bass = make(ctx.createBiquadFilter())
      bass.type = 'lowshelf'; bass.frequency.value = 100; bass.gain.value = 5
      const mid = make(ctx.createBiquadFilter())
      mid.type = 'peaking'; mid.frequency.value = 1000; mid.gain.value = -3; mid.Q.value = 0.8
      const treble = make(ctx.createBiquadFilter())
      treble.type = 'highshelf'; treble.frequency.value = 6000; treble.gain.value = -4
      bass.connect(mid); mid.connect(treble)
      return { input: bass, output: treble, nodes, cleanup: () => nodes.forEach(n => { try { n.disconnect() } catch { /**/ } }) }
    }

    case 'club': {
      const sub = make(ctx.createBiquadFilter())
      sub.type = 'lowshelf'; sub.frequency.value = 80; sub.gain.value = 6
      const cut = make(ctx.createBiquadFilter())
      cut.type = 'highshelf'; cut.frequency.value = 10000; cut.gain.value = -8
      sub.connect(cut)
      return { input: sub, output: cut, nodes, cleanup: () => nodes.forEach(n => { try { n.disconnect() } catch { /**/ } }) }
    }
  }
}
