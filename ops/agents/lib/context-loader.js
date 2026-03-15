// context-loader.js
// Shared utility for all VPS agents — loads skills, brand-context, and learnings
// from the ops/ directory and builds system prompts for Claude API calls.
//
// Usage:
//   const { buildSystemPrompt } = require('./lib/context-loader')
//   const systemPrompt = buildSystemPrompt(['reply-handler'], ['voice', 'icp'])

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const OPS_ROOT = resolve(__dir, '../..')

/**
 * Load a skill file by name (without .md extension).
 * e.g. loadSkill('reply-handler') reads ops/skills/reply-handler.md
 */
export function loadSkill(skillName) {
  const skillPath = resolve(OPS_ROOT, 'skills', `${skillName}.md`)
  try {
    return readFileSync(skillPath, 'utf-8')
  } catch (e) {
    console.warn(`[context-loader] Could not load skill '${skillName}': ${e.message}`)
    return ''
  }
}

/**
 * Load all three brand-context files.
 * Returns { voice, positioning, icp } — each a string.
 */
export function loadBrandContext() {
  const load = (name) => {
    try {
      return readFileSync(resolve(OPS_ROOT, 'brand-context', `${name}.md`), 'utf-8')
    } catch (e) {
      console.warn(`[context-loader] Could not load brand-context/${name}.md: ${e.message}`)
      return ''
    }
  }
  return {
    voice: load('voice'),
    positioning: load('positioning'),
    icp: load('icp'),
  }
}

/**
 * Load the learnings section for a specific skill from ops/learnings.md.
 * Returns just the relevant section text (or empty string if none logged yet).
 */
export function loadLearnings(skillName) {
  try {
    const learnings = readFileSync(resolve(OPS_ROOT, 'learnings.md'), 'utf-8')
    const regex = new RegExp(`### ${skillName}([\\s\\S]*?)(?=###|^---|\$)`, 'm')
    const match = learnings.match(regex)
    if (!match) return ''
    const section = match[1].trim()
    // Skip empty sections (just HTML comments)
    if (!section || section.startsWith('<!--')) return ''
    return section
  } catch (e) {
    return ''
  }
}

/**
 * Build a complete system prompt for a Claude API call.
 *
 * @param {string[]} skillNames - Skill names to load (e.g. ['reply-handler'])
 * @param {string[]} brandContextKeys - Brand context keys to include ('voice', 'positioning', 'icp')
 * @returns {string} Combined system prompt
 *
 * Example:
 *   buildSystemPrompt(['reply-handler'], ['voice', 'icp'])
 */
export function buildSystemPrompt(skillNames = [], brandContextKeys = []) {
  const brand = loadBrandContext()
  const parts = []

  // Add brand context sections first (foundation layer)
  for (const key of brandContextKeys) {
    if (brand[key]) parts.push(brand[key])
  }

  // Add each skill + its learnings
  for (const skillName of skillNames) {
    const skill = loadSkill(skillName)
    if (skill) parts.push(skill)

    const learnings = loadLearnings(skillName)
    if (learnings) {
      parts.push(`## Past Learnings for ${skillName}\n\nApply these corrections before generating output:\n\n${learnings}`)
    }
  }

  return parts.join('\n\n---\n\n')
}
