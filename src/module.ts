import { DataSourcePlugin } from '@grafana/data';
import { ConfigEditor } from './components/ConfigEditor';
import { QueryEditor } from './components/QueryEditor';
import { MyQuery, MyDataSourceOptions } from './types';
import { MyDataSource } from './datasource';

export const plugin = new DataSourcePlugin<MyDataSource, MyQuery, MyDataSourceOptions>(MyDataSource)
.setConfigEditor(ConfigEditor)
.setQueryEditor(QueryEditor);

console.log(plugin);
