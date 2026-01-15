import { TableTag, TableTagAssignment, TagColor } from "@/types";

const TAGS_STORAGE_KEY = "nodadb_tags";
const ASSIGNMENTS_STORAGE_KEY = "nodadb_tag_assignments";

// Get all tags
export function getTags(): TableTag[] {
  try {
    const data = localStorage.getItem(TAGS_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// Save tags
function saveTags(tags: TableTag[]) {
  localStorage.setItem(TAGS_STORAGE_KEY, JSON.stringify(tags));
}

// Create a new tag
export function createTag(name: string, color: TagColor): TableTag {
  const tags = getTags();
  const newTag: TableTag = {
    id: `tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    color,
    createdAt: Date.now(),
  };
  tags.push(newTag);
  saveTags(tags);
  return newTag;
}

// Update a tag
export function updateTag(id: string, name: string, color: TagColor): TableTag | null {
  const tags = getTags();
  const index = tags.findIndex((t) => t.id === id);
  if (index === -1) return null;

  tags[index] = { ...tags[index], name, color };
  saveTags(tags);
  return tags[index];
}

// Delete a tag
export function deleteTag(id: string): void {
  const tags = getTags().filter((t) => t.id !== id);
  saveTags(tags);

  // Also remove all assignments for this tag
  const assignments = getTagAssignments().filter((a) => a.tagId !== id);
  saveTagAssignments(assignments);
}

// Get tag by ID
export function getTagById(id: string): TableTag | null {
  return getTags().find((t) => t.id === id) || null;
}

// Get all tag assignments
export function getTagAssignments(): TableTagAssignment[] {
  try {
    const data = localStorage.getItem(ASSIGNMENTS_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// Save tag assignments
function saveTagAssignments(assignments: TableTagAssignment[]) {
  localStorage.setItem(ASSIGNMENTS_STORAGE_KEY, JSON.stringify(assignments));
}

// Assign a tag to a table
export function assignTagToTable(
  tableName: string,
  tagId: string,
  connectionId: string
): void {
  const assignments = getTagAssignments();

  // Remove any existing tag assignment for this table/connection
  const filtered = assignments.filter(
    (a) => !(a.tableName === tableName && a.connectionId === connectionId)
  );

  // Add new assignment
  filtered.push({ tableName, tagId, connectionId });
  saveTagAssignments(filtered);
}

// Remove tag assignment from a table
export function removeTagFromTable(
  tableName: string,
  connectionId: string
): void {
  const assignments = getTagAssignments().filter(
    (a) => !(a.tableName === tableName && a.connectionId === connectionId)
  );
  saveTagAssignments(assignments);
}

// Get tag for a specific table
export function getTagForTable(
  tableName: string,
  connectionId: string
): TableTag | null {
  const assignments = getTagAssignments();
  const assignment = assignments.find(
    (a) => a.tableName === tableName && a.connectionId === connectionId
  );
  if (!assignment) return null;
  return getTagById(assignment.tagId);
}

// Get all tables for a specific tag
export function getTablesForTag(
  tagId: string,
  connectionId: string
): string[] {
  const assignments = getTagAssignments();
  return assignments
    .filter((a) => a.tagId === tagId && a.connectionId === connectionId)
    .map((a) => a.tableName);
}
