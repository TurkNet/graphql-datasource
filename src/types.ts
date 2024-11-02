import { DataQuery } from '@grafana/schema';
import { DataSourceJsonData, AnnotationQuery, AnnotationSupport, AnnotationEvent,
   DataFrame, DataSourcePluginComponents,DataSourceApi, SystemVariable, DashboardProps,
   TestDataSourceResponse
  } from '@grafana/data';
import { Observable } from 'rxjs';
import { GraphQLAnnotationsSupport } from './components/GraphQLAnnotationsQueryCtrl';
import { VariableQueryEditor } from './components/VariableQueryEditor';

export interface MyQuery extends DataQuery {
  queryText?: string;
  dataPath: string;
  timePath: string;
  endTimePath: string | null;
  timeFormat: string | null;
  groupBy: string | null;
  aliasBy: string | null;
  annotationTitle: string;
  annotationText: string;
  annotationTags: string;
  constant: number;
}
export interface MyAnnotationQuery extends AnnotationQuery<MyQuery>{
  enable: boolean;
  hide: boolean;
  iconColor: string;
  name: string;
  showIn: number;
  refId: string;
}

export const defaultQuery: Partial<MyQuery> = {
  queryText: `query {
      data:submissions(user:"$user"){
          Time:submitTime
          idle running completed
      }
  }`,
  dataPath: 'data',
  timePath: 'Time',
  endTimePath: 'endTime',
  timeFormat: null,
  groupBy: '', // `identifier`
  aliasBy: '', // 'Server [[tag_identifier]]`
  annotationTitle: '',
  annotationText: '',
  annotationTags: '',
  constant: 6.5,
};
export class TestResponse implements TestDataSourceResponse{
  status: string;
  message: string;
  error?: Error | undefined;
  details?: { message?: string | undefined; verboseMessage?: string | undefined; } | undefined;
  constructor(status?: string, message?: string, error?: Error, details?: { message?: string, verboseMessage?: string }){
    this.status = status? status : "Failed";
    this.message = message? message : "None";
    this.error = error;
    this.details = details;
  }
  setStatus(status: string){
    this.status = status;
  }
  setMessage(message: string){
    this.message = message;
  }
  setError(error: Error){
    this.error = error;
  }
  setDetails(details: { message?: string | undefined; verboseMessage?: string | undefined; }){
    this.details = details;
  }
}

export interface MyAnnotationSupport extends AnnotationSupport<MyQuery, MyAnnotationQuery>{
  prepareAnnotation(json: any): MyAnnotationQuery;
  processEvents?(anno: MyAnnotationQuery, data: DataFrame[]): Observable<AnnotationEvent[] | undefined>;
  prepareQuery?(anno: MyAnnotationQuery): MyQuery | undefined;
  func(options: any): Promise<AnnotationEvent[]>  
}


export class MyDataSourcePluginComponents implements DataSourcePluginComponents<DataSourceApi<MyQuery, MyDataSourceOptions, {}>, MyQuery, MyDataSourceOptions> {
  AnnotationsQueryCtrl?: any;
  VariableQueryEditor?: any;
  constructor(){
    this.AnnotationsQueryCtrl = new GraphQLAnnotationsSupport();
    this.VariableQueryEditor =  VariableQueryEditor
  }
}


export interface MyDataSourceOptions extends DataSourceJsonData {
  path?: string;
}

export interface MySecureJsonData {
  apiKey?: string;
}
export interface MyVariableQuery extends DataQuery {
  dataPath: string;
  queryText: string;
}

export interface TextValuePair{
  text: string;
  value: any;
}

export interface MultiValueVariable extends SystemVariable<DashboardProps> {
  allValue?: string;
  id: string;
  uid: string;
  text: string;
  current: TextValuePair;
  options: TextValuePair[];
}

