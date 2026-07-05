const dataModules = import.meta.glob('../../assets/rashomon_study_data_*.json', { eager: true }) as Record<string, any>;

const mergedData: any = {
  metaData: { hyperparameterLevels: {} },
  configurationData: {}
};

for (const path in dataModules) {
  const mod = dataModules[path].default || dataModules[path];
  if (!mod.metaData || !mod.configurationData) continue;
  
  for (const [hp, levels] of Object.entries(mod.metaData.hyperparameterLevels)) {
    if (!mergedData.metaData.hyperparameterLevels[hp]) {
      mergedData.metaData.hyperparameterLevels[hp] = new Set();
    }
    (levels as string[]).forEach((l: string) => mergedData.metaData.hyperparameterLevels[hp].add(l));
  }
  Object.assign(mergedData.configurationData, mod.configurationData);
}

for (const hp in mergedData.metaData.hyperparameterLevels) {
  mergedData.metaData.hyperparameterLevels[hp] = Array.from(mergedData.metaData.hyperparameterLevels[hp]);
}

const allData = mergedData;
export interface DashboardData {
  X: Array<number>;
  Y: Array<number>;
  Z: Array<Array<number>> | null;
  type: "numerical" | "categorical" | "interaction"
  feat_name: string;
  x_ticks: Array<number> | null;
  y_ticks: Array<number> | null;
  x_labels: Array<string> | null;
  y_labels: Array<string> | null;
  x_name: string;
  y_name: string;
  smooth: boolean | null,
}
interface MetaData {
  hyperparameterLevels: Record<string, string[]>
}

export type DashboardDataByConfiguration = Record<string, {plotData: Array<DashboardData>; score: number;}>
export type HyperParameterLevels = Record<string, string[]>


interface PlotData {
  metaData: MetaData;
  configurationData: DashboardDataByConfiguration;
}

function normalizeKeys(configurationData: DashboardDataByConfiguration) : DashboardDataByConfiguration {
  return Object.entries(configurationData).reduce((acc, [key, value]) => {
    const normalizedKey = JSON.stringify(JSON.parse(key))
    acc[normalizedKey] = value
    return acc
  }, {} as DashboardDataByConfiguration)
}

export const normalizedData = {
  ...allData,
  configurationData: normalizeKeys(allData.configurationData as DashboardDataByConfiguration)
} as PlotData

export const hyperParameterLevels: HyperParameterLevels = normalizedData.metaData.hyperparameterLevels
