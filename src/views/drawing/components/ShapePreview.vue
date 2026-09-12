<template>
  <span class="shape-preview" :class="[`is-${preview}`, { 'is-compact': compact }]" aria-hidden="true">
    <svg v-if="linePreview" class="shape-svg is-line" viewBox="0 0 32 24">
      <path
        class="line-path"
        fill="none"
        :d="linePreview.d"
        :stroke-dasharray="linePreview.dashed ? '3.2 2.2' : null"
      />
      <path
        v-if="linePreview.startHead"
        class="line-head"
        :class="{ 'is-open': linePreview.start === 'classic' }"
        :d="linePreview.startHead"
      />
      <path
        v-if="linePreview.endHead"
        class="line-head"
        :class="{ 'is-open': linePreview.end === 'classic' }"
        :d="linePreview.endHead"
      />
    </svg>
    <svg v-else-if="path" class="shape-svg" viewBox="0 0 32 24">
      <path :d="path" />
    </svg>
    <svg v-else-if="preview === 'anim-pulse'" class="shape-svg is-anim" viewBox="0 0 32 24">
      <rect class="anim-shape" x="11" y="7.5" width="10" height="9" rx="2" />
      <rect class="anim-hint" x="7.5" y="4.5" width="17" height="15" rx="3.5" />
      <rect class="anim-hint faint" x="4.5" y="2" width="23" height="20" rx="5" />
    </svg>
    <svg v-else-if="preview === 'anim-breathe'" class="shape-svg is-anim" viewBox="0 0 32 24">
      <rect class="anim-hint" x="6" y="4" width="20" height="16" rx="4" />
      <rect class="anim-shape" x="10" y="7" width="12" height="10" rx="2.5" />
    </svg>
    <svg v-else-if="preview === 'anim-bounce'" class="shape-svg is-anim" viewBox="0 0 32 24">
      <rect class="anim-shape" x="11" y="3.5" width="10" height="8" rx="2" />
      <path class="anim-hint" d="M8 21 H24" />
      <path class="anim-hint" d="M16 13.5 V17.5" />
      <path class="anim-arrow" d="M13.2 16.2 L16 19.2 L18.8 16.2" />
    </svg>
    <svg v-else-if="preview === 'anim-flow'" class="shape-svg is-anim" viewBox="0 0 32 24">
      <path class="anim-hint dashed" d="M3 12 C 9 6 14 18 20 12" />
      <path class="anim-shape-stroke" d="M12 12 C 18 6 23 18 29 12" />
      <path class="anim-arrow filled" d="M25.2 8.8 L30.2 12 L25.2 15.2 Z" />
    </svg>
    <svg v-else-if="preview === 'anim-stop'" class="shape-svg is-anim" viewBox="0 0 32 24">
      <rect class="anim-shape" x="11.5" y="6" width="3.6" height="12" rx="1" />
      <rect class="anim-shape" x="16.9" y="6" width="3.6" height="12" rx="1" />
    </svg>
    <i v-else></i>
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  preview: { type: String, default: 'rect' },
  compact: { type: Boolean, default: false }
})

const SVG_PATHS = {
  star: 'M16 3 L18.12 9.09 L24.56 9.22 L19.42 13.11 L21.29 19.28 L16 15.6 L10.71 19.28 L12.58 13.11 L7.44 9.22 L13.88 9.09 Z',
  hexagon: 'M10.5 5 H21.5 L27 12 L21.5 19 H10.5 L5 12 Z',
  diamond: 'M16 4.5 L25.5 12 L16 19.5 L6.5 12 Z',
  triangle: 'M16 5 L26.5 19.5 H5.5 Z',
  parallelogram: 'M10 6 H26 L22 18 H6 Z',
  display: 'M8 6 H26 V18 H8 L4 12 Z',
  note: 'M8 4 H20 L24 8 V20 H8 Z',
  'er-ident': 'M16 4.5 L25.5 12 L16 19.5 L6.5 12 Z'
}

const LINE_PREVIEWS = {
  'line-straight': {
    d: 'M3 12 H29'
  },
  'line-arrow': {
    d: 'M3 12 H23',
    end: 'block',
    endHead: 'M23 8.2 L29.6 12 L23 15.8 Z'
  },
  'line-double': {
    d: 'M9 12 H23',
    start: 'block',
    end: 'block',
    startHead: 'M9 8.2 L2.4 12 L9 15.8 Z',
    endHead: 'M23 8.2 L29.6 12 L23 15.8 Z'
  },
  'line-dashed': {
    d: 'M3 12 H23',
    dashed: true,
    end: 'block',
    endHead: 'M23 8.2 L29.6 12 L23 15.8 Z'
  },
  'line-orth': {
    d: 'M4 18 H16 V7 H22.5',
    end: 'block',
    endHead: 'M22.5 3.4 L29.2 7 L22.5 10.6 Z'
  },
  'line-manhattan': {
    d: 'M4 18 H11 V12 H18 V7 H22.5',
    end: 'block',
    endHead: 'M22.5 3.4 L29.2 7 L22.5 10.6 Z'
  },
  'line-curve': {
    d: 'M4 18 C 12 18 12 6 22.5 6',
    end: 'classic',
    endHead: 'M21.2 2.6 L29 6 L21.2 9.4'
  }
}

const path = computed(() => SVG_PATHS[props.preview] || '')
const linePreview = computed(() => LINE_PREVIEWS[props.preview] || null)
</script>

<style scoped>
.shape-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 32px;
  overflow: visible;
  color: inherit;
}
.shape-preview.is-compact {
  width: 32px;
  height: 24px;
}
.shape-svg {
  width: 100%;
  height: 100%;
  overflow: visible;
  fill: color-mix(in srgb, var(--bg-primary) 80%, transparent);
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.shape-svg.is-line {
  fill: none;
}
.line-head {
  fill: currentColor;
  stroke: none;
}
.line-head.is-open {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
}
.shape-svg.is-anim .anim-shape {
  fill: color-mix(in srgb, var(--bg-primary) 80%, transparent);
  stroke: currentColor;
  stroke-width: 1.4;
}
.shape-svg.is-anim .anim-shape-stroke {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
}
.shape-svg.is-anim .anim-hint {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.2;
  opacity: 0.42;
}
.shape-svg.is-anim .anim-hint.faint { opacity: 0.2; }
.shape-svg.is-anim .anim-hint.dashed { stroke-dasharray: 2.4 1.8; }
.shape-svg.is-anim .anim-arrow {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.3;
}
.shape-svg.is-anim .anim-arrow.filled {
  fill: currentColor;
  stroke: none;
}
.shape-preview i {
  display: block;
  box-sizing: border-box;
  border: 1.5px solid currentColor;
  background: color-mix(in srgb, var(--bg-primary) 80%, transparent);
}
.is-rect i,
.is-process i { width: 30px; height: 16px; border-radius: 3px; }
.is-rounded i { width: 30px; height: 16px; border-radius: 8px; }
.is-circle i { width: 18px; height: 18px; border-radius: 50%; }
.is-ellipse i,
.is-terminator i { width: 28px; height: 16px; border-radius: 10px; }
.is-cloud i { width: 28px; height: 16px; border-radius: 12px; }
.is-cylinder i { width: 18px; height: 22px; border-radius: 10px / 5px; }
.is-document i { width: 20px; height: 22px; border-radius: 2px 2px 8px 8px; }
.is-sticky i { width: 18px; height: 18px; border-radius: 2px; background: #fef3c7; border-color: #f59e0b; }
.is-text i { width: 26px; height: 2px; border: 0; background: currentColor; box-shadow: 0 6px 0 currentColor, 0 12px 0 currentColor; }
.is-image i { width: 24px; height: 18px; border-style: dashed; border-radius: 3px; }
.is-container i { width: 30px; height: 20px; border-style: dashed; border-radius: 4px; }
.is-delay i { width: 24px; height: 16px; border-radius: 0 10px 10px 0; }
.is-manual i { width: 26px; height: 16px; transform: skewY(-8deg); }
.is-mind-root i { width: 28px; height: 14px; border-radius: 10px; background: color-mix(in srgb, var(--accent-color) 18%, transparent); border-color: var(--accent-color); }
.is-mind-topic i { width: 26px; height: 12px; border-radius: 6px; }
.is-mind-sub i { width: 22px; height: 10px; border-radius: 4px; }
.is-mind-callout i { width: 24px; height: 14px; border-radius: 10px; background: #fef3c7; border-color: #f59e0b; }
.is-er-entity i,
.is-er-weak i { width: 28px; height: 16px; border-radius: 3px; }
.is-er-weak i { outline: 1px solid currentColor; outline-offset: 2px; }
.is-er-key i { width: 26px; height: 14px; border-radius: 10px; }
.is-uml-class i { width: 24px; height: 22px; border-radius: 2px; background: linear-gradient(#c4b5fd 0 7px, transparent 7px) padding-box; }
.is-actor i { width: 12px; height: 20px; border-radius: 8px 8px 2px 2px; }
.is-package i { width: 26px; height: 18px; border-radius: 2px; }
.is-component i { width: 26px; height: 16px; border-radius: 3px; }
.is-tl-axis i { width: 32px; height: 3px; border: 0; background: currentColor; border-radius: 2px; }
.is-seq-actor i { width: 16px; height: 22px; border-radius: 3px 3px 0 0; box-shadow: inset 0 -12px 0 -10px currentColor; }
.is-seq-act i { width: 6px; height: 20px; border-radius: 1px; }
.is-arch-client i,
.is-arch-server i,
.is-arch-db i,
.is-arch-cloud i,
.is-arch-queue i,
.is-arch-cache i,
.is-arch-gateway i { width: 28px; height: 14px; border-radius: 6px; }
.is-dfd-ext i { width: 26px; height: 16px; border-width: 2px; }
.is-dfd-store i { width: 28px; height: 12px; border-left-width: 3px; border-right-width: 3px; }
.is-tpl-mind i,
.is-tpl-flow i,
.is-tpl-er i,
.is-tpl-timeline i,
.is-tpl-seq i,
.is-tpl-arch i,
.is-tpl-dfd i { width: 28px; height: 18px; border-style: dashed; border-radius: 4px; }
</style>
