import { create } from 'zustand';
import type { SimulationPlan, Die } from '../types';
import { simulateBattle, generatePlanName } from '../utils/simulateBattle';
import { getAllocations } from '../utils/battle';
import { useGameStore } from './useGameStore';
import { useDiceStore } from './useDiceStore';
import { useConfigStore } from './useConfigStore';

const STORAGE_KEY = 'starship_simulation_plans';

function loadPlansFromStorage(): SimulationPlan[] {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load simulation plans:', e);
  }
  return [];
}

function savePlansToStorage(plans: SimulationPlan[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
  } catch (e) {
    console.error('Failed to save simulation plans:', e);
  }
}

function clearPlansFromStorage() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear simulation plans:', e);
  }
}

interface SimulationState {
  plans: SimulationPlan[];
  selectedPlanId: string | null;
  isSimulating: boolean;
  lastAppliedPlanId: string | null;
  
  runSimulation: (dice: Die[]) => SimulationPlan | null;
  saveSimulationPlan: (plan: SimulationPlan) => void;
  deleteSimulationPlan: (planId: string) => void;
  selectSimulationPlan: (planId: string | null) => void;
  applySimulationPlan: (planId: string) => boolean;
  clearAllPlans: () => void;
  setIsSimulating: (value: boolean) => void;
  get energyCostPerSimulation(): number;
  get maxSavedPlans(): number;
  clearLastApplied: () => void;
  loadSavedPlans: () => void;
}

export const useSimulationStore = create<SimulationState>((set, get) => ({
  plans: [],
  selectedPlanId: null,
  isSimulating: false,
  lastAppliedPlanId: null,
  
  get energyCostPerSimulation() {
    return useConfigStore.getState().config.simulationEnergyCost;
  },
  
  get maxSavedPlans() {
    return useConfigStore.getState().config.maxSavedSimulations;
  },
  
  loadSavedPlans: () => {
    const savedPlans = loadPlansFromStorage();
    const maxSaved = get().maxSavedPlans;
    const trimmedPlans = savedPlans.slice(0, maxSaved);
    set({ plans: trimmedPlans });
  },
  
  runSimulation: (dice: Die[]) => {
    const { energyCostPerSimulation } = get();
    const battleState = useGameStore.getState().battleState;
    const config = useConfigStore.getState().config;
    
    if (!battleState || !battleState.player || !battleState.enemy) {
      return null;
    }
    
    if (battleState.player.energy < energyCostPerSimulation) {
      alert(`能量不足！预演需要 ${energyCostPerSimulation} 能量`);
      return null;
    }
    
    set({ isSimulating: true });
    
    try {
      const playerAfterCost = {
        ...battleState.player,
        energy: battleState.player.energy - energyCostPerSimulation,
      };
      
      useGameStore.setState((state) => ({
        battleState: state.battleState ? {
          ...state.battleState,
          player: playerAfterCost,
          logs: [
            ...state.battleState.logs,
            {
              id: `log_${Date.now()}_sim`,
              turn: state.battleState.turn,
              type: 'effect' as const,
              source: 'system' as const,
              message: `战术沙盘消耗 ${energyCostPerSimulation} 能量进行预演`,
              value: energyCostPerSimulation,
              timestamp: Date.now(),
            },
          ],
        } : state.battleState,
      }));
      
      const metrics = simulateBattle(
        dice,
        battleState.player,
        battleState.enemy,
        config
      );
      
      const allocations = getAllocations(dice);
      const planName = generatePlanName(allocations);
      
      const plan: SimulationPlan = {
        id: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        name: planName,
        diceAllocation: JSON.parse(JSON.stringify(dice)),
        metrics,
      };
      
      get().saveSimulationPlan(plan);
      
      setTimeout(() => {
        set({ isSimulating: false });
      }, 500);
      
      return plan;
    } catch (error) {
      console.error('Simulation error:', error);
      set({ isSimulating: false });
      return null;
    }
  },
  
  saveSimulationPlan: (plan: SimulationPlan) => {
    const { plans, maxSavedPlans } = get();
    
    let newPlans = [plan, ...plans];
    
    if (newPlans.length > maxSavedPlans) {
      newPlans = newPlans.slice(0, maxSavedPlans);
    }
    
    set({ plans: newPlans });
    savePlansToStorage(newPlans);
  },
  
  deleteSimulationPlan: (planId: string) => {
    const { plans, selectedPlanId, lastAppliedPlanId } = get();
    const newPlans = plans.filter(p => p.id !== planId);
    
    set({
      plans: newPlans,
      selectedPlanId: selectedPlanId === planId ? null : selectedPlanId,
      lastAppliedPlanId: lastAppliedPlanId === planId ? null : lastAppliedPlanId,
    });
    savePlansToStorage(newPlans);
  },
  
  selectSimulationPlan: (planId: string | null) => {
    set({ selectedPlanId: planId });
  },
  
  applySimulationPlan: (planId: string) => {
    const { plans } = get();
    const plan = plans.find(p => p.id === planId);
    
    if (!plan) return false;
    
    const diceStore = useDiceStore.getState();
    diceStore.setDice(JSON.parse(JSON.stringify(plan.diceAllocation)));
    
    set({ 
      selectedPlanId: null,
      lastAppliedPlanId: planId,
    });
    
    setTimeout(() => {
      set({ lastAppliedPlanId: null });
    }, 3000);
    
    return true;
  },
  
  clearAllPlans: () => {
    set({
      plans: [],
      selectedPlanId: null,
      lastAppliedPlanId: null,
    });
    clearPlansFromStorage();
  },
  
  setIsSimulating: (value: boolean) => {
    set({ isSimulating: value });
  },
  
  clearLastApplied: () => {
    set({ lastAppliedPlanId: null });
  },
}));
