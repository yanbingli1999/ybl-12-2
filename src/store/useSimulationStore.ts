import { create } from 'zustand';
import type { SimulationPlan, Die, SimulationMetrics } from '../types';
import { simulateBattle, generatePlanName } from '../utils/simulateBattle';
import { getAllocations } from '../utils/battle';
import { useGameStore } from './useGameStore';
import { useDiceStore } from './useDiceStore';
import { useConfigStore } from './useConfigStore';
import { useShipStore } from './useShipStore';

interface SimulationState {
  plans: SimulationPlan[];
  selectedPlanId: string | null;
  isSimulating: boolean;
  
  runSimulation: (dice: Die[]) => SimulationPlan | null;
  saveSimulationPlan: (plan: SimulationPlan) => void;
  deleteSimulationPlan: (planId: string) => void;
  selectSimulationPlan: (planId: string | null) => void;
  applySimulationPlan: (planId: string) => void;
  clearAllPlans: () => void;
  setIsSimulating: (value: boolean) => void;
  get energyCostPerSimulation(): number;
  get maxSavedPlans(): number;
}

export const useSimulationStore = create<SimulationState>((set, get) => ({
  plans: [],
  selectedPlanId: null,
  isSimulating: false,
  
  get energyCostPerSimulation() {
    return useConfigStore.getState().config.simulationEnergyCost;
  },
  
  get maxSavedPlans() {
    return useConfigStore.getState().config.maxSavedSimulations;
  },
  
  runSimulation: (dice: Die[]) => {
    const { energyCostPerSimulation } = get();
    const gameState = useGameStore.getState().battleState;
    const config = useConfigStore.getState().config;
    const shipStore = useShipStore.getState();
    
    if (!gameState || !gameState.player || !gameState.enemy) {
      return null;
    }
    
    if (gameState.player.energy < energyCostPerSimulation) {
      alert(`能量不足！预演需要 ${energyCostPerSimulation} 能量`);
      return null;
    }
    
    set({ isSimulating: true });
    
    try {
      const playerWithEnergy = {
        ...gameState.player,
        energy: gameState.player.energy - energyCostPerSimulation,
      };
      
      useGameStore.getState().battleState!.player = playerWithEnergy;
      shipStore.ship = playerWithEnergy;
      
      const metrics = simulateBattle(
        dice,
        playerWithEnergy,
        gameState.enemy,
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
  },
  
  deleteSimulationPlan: (planId: string) => {
    const { plans, selectedPlanId } = get();
    const newPlans = plans.filter(p => p.id !== planId);
    
    set({
      plans: newPlans,
      selectedPlanId: selectedPlanId === planId ? null : selectedPlanId,
    });
  },
  
  selectSimulationPlan: (planId: string | null) => {
    set({ selectedPlanId: planId });
  },
  
  applySimulationPlan: (planId: string) => {
    const { plans } = get();
    const plan = plans.find(p => p.id === planId);
    
    if (!plan) return;
    
    const diceStore = useDiceStore.getState();
    diceStore.setDice(JSON.parse(JSON.stringify(plan.diceAllocation)));
    
    set({ selectedPlanId: null });
  },
  
  clearAllPlans: () => {
    set({
      plans: [],
      selectedPlanId: null,
    });
  },
  
  setIsSimulating: (value: boolean) => {
    set({ isSimulating: value });
  },
}));
