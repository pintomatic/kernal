// Shared types used across @kernal/ui components

export interface EntityFocus {
  type: 'person' | 'organization' | 'deal' | 'goal' | 'pattern' | 'plan' | 'system' | 'project';
  id: number;
  name: string;
}
