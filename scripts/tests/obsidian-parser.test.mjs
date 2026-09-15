import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'

import {
  parseObsidianMarkdown,
  transformObsidianMarkdown
} from '../../src-electron/obsidian/parser.js'

test('parses frontmatter tags aliases wikilinks embeds and inline tags', () => {
  const markdown = `---
title: Demo Note
tags:
  - project/demo
aliases: [Demo, Sample]
---
# Demo

See [[Other Note|the other note]] and [[Folder/Target#Heading]].

![[attachments/image.png]]

Inline tags: #todo #nested/tag.

\`\`\`
#not-a-tag [[not-a-link]]
\`\`\`
`

  const parsed = parseObsidianMarkdown(markdown, { filePath: 'Demo.md' })

  assert.equal(parsed.frontmatter.title, 'Demo Note')
  assert.deepEqual(parsed.aliases, ['Demo', 'Sample'])
  assert.deepEqual(parsed.tags.sort(), ['nested/tag', 'project/demo', 'todo'])
  assert.equal(parsed.wikilinks.length, 2)
  assert.deepEqual(parsed.wikilinks[0], {
    raw: '[[Other Note|the other note]]',
    target: 'Other Note',
    heading: '',
    alias: 'the other note',
    embed: false
  })
  assert.equal(parsed.embeds.length, 1)
  assert.equal(parsed.embeds[0].target, 'attachments/image.png')
  assert.ok(!parsed.body.includes('title: Demo Note'))
  assert.ok(!parsed.tags.includes('not-a-tag'))
})

test('transforms wikilinks and local image references for preview', async () => {
  const rootDir = path.resolve('vault')
  const filePath = path.join(rootDir, 'Notes', 'Demo.md')
  const imagePath = path.join(rootDir, 'Notes', 'pic.png')
  const imageDataUrl = 'data:image/png;base64,abc'

  const result = await transformObsidianMarkdown('See [[Target|target]].\n\n![](pic.png)\n\n![[pic.png]]', {
    filePath,
    rootDir,
    resolveAsset: async (assetPath) => {
      assert.equal(assetPath, imagePath)
      return imageDataUrl
    }
  })

  assert.match(result.markdown, /\[target\]\(obsidian-link:0\)/)
  assert.match(result.markdown, /!\[\]\(data:image\/png;base64,abc\)/)
  assert.match(result.markdown, /!\[pic\.png\]\(data:image\/png;base64,abc\)/)
  assert.equal(result.linkMap['obsidian-link:0'].target, 'Target')
})

