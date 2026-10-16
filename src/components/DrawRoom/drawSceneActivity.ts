import { createContext, useContext } from 'react';

// Preparation continues for every mounted stage. Only the selected stage runs
// its animation loop; navigating never disposes its prepared GPU resources.
export const DrawSceneActivity = createContext(true);
export const useDrawSceneActivity = () => useContext(DrawSceneActivity);
