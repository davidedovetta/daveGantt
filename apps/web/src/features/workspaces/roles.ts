import type { Role } from '@davegantt/shared';

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: 'Proprietario',
  EDITOR: 'Editor',
  VIEWER: 'Lettore',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  OWNER: 'Modifica e gestisce i membri',
  EDITOR: 'Modifica progetti e task',
  VIEWER: 'Sola lettura',
};

export const ROLES: Role[] = ['OWNER', 'EDITOR', 'VIEWER'];
