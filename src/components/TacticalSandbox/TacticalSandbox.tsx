import React, { useState } from 'react';
import { Eye, Zap, BarChart3, Trash2, X, Play, Loader2, GitCompare } from 'lucide-react';
import { SimulationCard } from './SimulationCard';
import { useSimulationStore } from '../../store/useSimulationStore';
import { useDiceStore } from '../../store/useDiceStore';
import { useGameStore } from '../../store/useGameStore';
import { hasAnyDiceAssigned } from '../../utils/dice';
import { Modal } from '../UI/Modal';

interface TacticalSandboxProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TacticalSandbox: React.FC<TacticalSandboxProps> = ({ isOpen, onClose }) => {
  const { 
    plans, 
    selectedPlanId, 
    isSimulating, 
    runSimulation, 
    clearAllPlans,
  } = useSimulationStore();
  const state = useSimulationStore.getState();
  const energyCostPerSimulation = state.energyCostPerSimulation;
  const maxSavedPlans = state.maxSavedPlans;
  
  const { dice } = useDiceStore();
  const { battleState } = useGameStore();
  const [showComparison, setShowComparison] = useState(false);
  
  const canSimulate = hasAnyDiceAssigned(dice) && !isSimulating;
  const currentEnergy = battleState?.player?.energy || 0;
  const hasEnoughEnergy = currentEnergy >= energyCostPerSimulation;
  
  const handleRunSimulation = () => {
    if (!canSimulate || !hasEnoughEnergy) return;
    runSimulation(dice);
  };
  
  const handleClose = () => {
    onClose();
  };
  
  const renderComparisonView = () => {
    if (plans.length < 2) return null;
    
    const metricsToCompare = [
      { key: 'playerDamageToEnemy', label: '对敌伤害', getValue: (m: any) => `${m.playerDamageToEnemy.min}-${m.playerDamageToEnemy.max}` },
      { key: 'enemyDamageToPlayer', label: '受到伤害', getValue: (m: any) => `${m.enemyDamageToPlayer.min}-${m.enemyDamageToPlayer.max}` },
      { key: 'playerShieldGain', label: '护盾恢复', getValue: (m: any) => m.playerShieldGain.expected > 0 ? `${m.playerShieldGain.expected}` : '-' },
      { key: 'playerHealGain', label: '生命恢复', getValue: (m: any) => m.playerHealGain.expected > 0 ? `${m.playerHealGain.expected}` : '-' },
      { key: 'energyCost', label: '能量消耗', getValue: (m: any) => {
        const gapText = m.energyGap > 0 ? ' (缺口: ' + m.energyGap + ')' : '';
        return m.energyCost + gapText;
      }},
      { key: 'survivalRisk', label: '生存风险', getValue: (m: any) => {
        const labels: Record<string, string> = { low: '低', medium: '中', high: '高', critical: '致命' };
        return labels[m.survivalRisk];
      }},
      { key: 'expectedPlayerHp', label: '期望HP', getValue: (m: any) => `${m.expectedPlayerHp.expected}` },
      { key: 'expectedEnemyHp', label: '期望敌方HP', getValue: (m: any) => `${m.expectedEnemyHp.expected}` },
    ];
    
    return (
      <div className="mt-4 p-4 bg-space-900/50 rounded-lg">
      <h4 className="font-display font-bold text-white mb-3 flex items-center gap-2">
        <GitCompare className="w-4 h-4 text-neon-blue" />
        方案对比
      </h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-space-600">
              <th className="text-left py-2 px-3 text-gray-400 font-normal">指标</th>
              {plans.map((plan, idx) => (
                <th key={plan.id} className="text-center py-2 px-3 text-gray-400 font-normal">
                  方案{idx + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metricsToCompare.map(metric => (
              <tr key={metric.key} className="border-b border-space-700/50">
                <td className="py-2 px-3 text-gray-400">{metric.label}</td>
                {plans.map(plan => (
                  <td key={plan.id} className="text-center py-2 px-3 text-white font-mono">
                    {metric.getValue(plan.metrics)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
    );
  };
  
  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="回合战术沙盘"
      maxWidth="max-w-4xl"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Zap className="w-4 h-4 text-neon-yellow" />
              <span>当前能量: </span>
              <span className="font-mono text-white">{currentEnergy}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Eye className="w-4 h-4 text-neon-blue" />
              <span>预演消耗: </span>
              <span className="font-mono text-white">{energyCostPerSimulation}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <BarChart3 className="w-4 h-4 text-neon-purple" />
              <span>已保存: </span>
              <span className="font-mono text-white">{plans.length}/{maxSavedPlans}</span>
            </div>
          </div>
          
          <div className="flex gap-2">
            {plans.length >= 2 && (
              <button
                onClick={() => setShowComparison(!showComparison)}
                className={
                  'px-3 py-2 rounded-lg text-sm flex items-center gap-1 transition-colors ' +
                  (showComparison 
                    ? 'bg-neon-blue text-space-900' 
                    : 'bg-space-700 text-gray-300 hover:bg-space-600')
                }
              >
                <GitCompare className="w-4 h-4" />
                对比
              </button>
            )}
            
            {plans.length > 0 && (
              <button
                onClick={clearAllPlans}
                className="px-3 py-2 bg-space-700 border border-space-600 rounded-lg text-sm text-gray-400 hover:bg-neon-red/20 hover:text-neon-red hover:border-neon-red/30 transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" />
                清空
              </button>
            )}
          </div>
        </div>
        
        <div className="p-4 bg-space-900/30 rounded-lg border border-dashed border-space-600">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-display font-bold text-white mb-1">预演当前分配</h4>
              <p className="text-sm text-gray-400">
                {hasAnyDiceAssigned(dice) 
                  ? '点击按钮预演当前骰子分配的可能结果' 
                  : '请先分配骰子到舱位后再进行预演'}
              </p>
            </div>
            <button
              onClick={handleRunSimulation}
              disabled={!canSimulate || !hasEnoughEnergy}
              className={
                'btn-primary flex items-center gap-2 ' +
                ((!canSimulate || !hasEnoughEnergy) ? 'opacity-50 cursor-not-allowed' : '')
              }
            >
              {isSimulating ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
              {isSimulating ? '预演中...' : '开始预演'}
            </button>
          </div>
          
          {!hasEnoughEnergy && hasAnyDiceAssigned(dice) && (
            <p className="text-xs text-neon-red mt-2">
              能量不足！需要 {energyCostPerSimulation} 能量，当前 {currentEnergy}
            </p>
          )}
        </div>
        
        {showComparison && renderComparisonView()}
        
        <div>
          <h4 className="font-display font-bold text-white mb-3">已保存的预演方案</h4>
          
          {plans.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Eye className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>暂无预演方案</p>
              <p className="text-sm">分配骰子后点击"开始预演"来生成方案</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {plans.map((plan, index) => (
                <SimulationCard
                  key={plan.id}
                  plan={plan}
                  isSelected={selectedPlanId === plan.id}
                  index={index}
                />
              ))}
            </div>
          )}
        </div>
        
        <div className="flex justify-end pt-4 border-t border-space-600">
          <button
            onClick={handleClose}
            className="px-6 py-2 bg-space-700 border border-space-600 rounded-lg text-white hover:bg-space-600 transition-colors flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            关闭
          </button>
        </div>
      </div>
    </Modal>
  );
};
