export interface Task {
  id: string;
  task_name: string;
  periodicity: string;
  instructions: string[];
  lastCompletedDate: string | null; // ISO Date
}

export interface Equipment {
  id: string;
  name: string;
  type: string;
  location: string;
  maintenance_schedule: Task[];
  important_rules: string[];
}

export interface AppSettings {
  yandexApiKey: string;
  yandexFolderId: string;
  yandexSearchApiKey: string;
}
