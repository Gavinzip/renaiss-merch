import { useDrawRoomAccess } from '../DrawRoom/useDrawRoomAccess';
export function useSurfDrawAccess() { return useDrawRoomAccess('/api/auth/surf-draw'); }
