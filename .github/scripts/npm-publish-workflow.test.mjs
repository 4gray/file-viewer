import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const scriptsDir = dirname(fileURLToPath(import.meta.url))
const workflowPath = join(scriptsDir, '..', 'workflows', 'npm-publish.yml')

test('manual publishing checks out the dispatcher SHA while release events use the immutable tag', async () => {
  const workflow = await readFile(workflowPath, 'utf8')
  assert.match(workflow, /workflow_dispatch:/)
  assert.match(
    workflow,
    /ref: \$\{\{ github\.event_name == 'workflow_dispatch' && github\.sha \|\| github\.event\.release\.tag_name \}\}/
  )
  assert.match(
    workflow,
    /FILE_VIEWER_RELEASE_TAG: \$\{\{ github\.event\.release\.tag_name \|\| inputs\.release_tag \}\}/
  )
})
