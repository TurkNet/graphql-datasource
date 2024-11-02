
import {AnnotationSupport, QueryEditorProps, DataSourceApi, DataSourceJsonData, DataFrame, AnnotationEvent}from '@grafana/data';

import { ComponentType } from 'react';

import {MyQuery, MyAnnotationQuery, MyDataSourceOptions} from "../types";
import { Observable } from 'rxjs';
DataSourceApi<MyQuery, MyDataSourceOptions>
type Props = QueryEditorProps<DataSourceApi<MyAnnotationQuery, MyDataSourceOptions, {}>, MyAnnotationQuery, MyDataSourceOptions>;
declare type AnnotationQueryEditorProps = Props & {
  annotation?: MyAnnotationQuery;
  onAnnotationChange?: (annotation: MyAnnotationQuery) => void;
};


export class GraphQLAnnotationsSupport implements AnnotationSupport<MyQuery, MyAnnotationQuery> {
  static templateUrl = 'partials/annotations.editor.html';

  QueryEditor?: ComponentType<QueryEditorProps<any, MyQuery, DataSourceJsonData, MyQuery>>;
  prepareAnnotation?(json: any): MyAnnotationQuery;
  prepareQuery?(anno: MyAnnotationQuery): MyQuery | undefined;
  processEvents?(anno: MyAnnotationQuery, data: DataFrame[]): Observable<AnnotationEvent[] | undefined>;
  getDefaultQuery?(): Partial<MyQuery>;
  
}

