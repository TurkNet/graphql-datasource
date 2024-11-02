import defaults from 'lodash/defaults';
import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  MetricFindValue,
  DataSourceInstanceSettings,
  ScopedVars,
  TimeRange,
  dateTime,
  FieldType,
  DataFrame,
  MutableDataFrame,
  AnnotationEvent,
  TestDataSourceResponse
} from '@grafana/data';


import {
  MyQuery,
  MyDataSourceOptions,
  defaultQuery,
  MyVariableQuery,
  MultiValueVariable,
  TextValuePair,
  MyDataSourcePluginComponents,
  TestResponse
} from './types';

import _ from 'lodash';
import { flatten, isRFC3339_ISO6801 } from './util';
import { getTemplateSrv } from '@grafana/runtime';
const supportedVariableTypes = ['constant', 'custom', 'query', 'textbox'];

function replaceTemplateVariables(queryText: string | undefined, variables: any): string {
  let replacedQuery = queryText? queryText : "";
  // Loop over all variables and replace them in the query text
  Object.keys(variables).forEach(key => {
      const value = variables[key];
      replacedQuery = replacedQuery.replace(`\$\{${key}\}`, value.text);
  });
  return replacedQuery;
}


export class MyDataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {
  basicAuth: string | undefined;
  withCredentials: boolean | undefined;
  url: string | undefined;
  uid: string;
  id: number;
  // Implement these helper methods based on your data structure and requirements
  getDataPathArray(dataPath: string): string[] {
    // Extract data paths from the provided path string
    return dataPath.split(',').map(path => path.trim());
  }
  
 
  
  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>, private backendSrv: any) {
    super(instanceSettings);
    this.basicAuth = instanceSettings.basicAuth;
    this.withCredentials = instanceSettings.withCredentials;
    this.url = instanceSettings.url;
    this.uid = instanceSettings.uid;
    this.id = instanceSettings.id;
    this.components = new MyDataSourcePluginComponents()
  }
    
  

    
  private request(data: string) {
    const options: any = {
      url: this.url,
      method: 'POST',
      data: {
        query: data,
      },
    };

    if (this.basicAuth || this.withCredentials) {
      options.withCredentials = true;
    }
    if (this.basicAuth) {
      options.headers = {
        Authorization: this.basicAuth,
      };
    }

    return this.backendSrv.datasourceRequest(options);
  }

  private postQuery(query: Partial<MyQuery>, payload: string) {
    console.log(payload)
    return this.request(payload)
      .then((results: any) => {
        return { query, results };
      })
      .catch((err: any) => {
        if (err.data && err.data.error) {
          throw {
            message: 'GraphQL error: ' + err.data.error.reason,
            error: 'GraphQL error: ' + err.data.error
          };
        }

        throw 'GraphQL error: ' + err.data.error;
      });
  }

  private createQuery(query: MyQuery, range: TimeRange | undefined, scopedVars: ScopedVars | undefined = undefined) {
    let payload = replaceTemplateVariables(query.queryText, {
      ...scopedVars,
      timeFrom: { text: 'from', value: range?.from.valueOf() },
      timeTo: { text: 'to', value: range?.to.valueOf() },
    });
    //console.log(payload);
    return this.postQuery(query, payload);
  }
  static getDocs(frame: DataFrame, path: string): any[] {
    // Extract documents from the DataFrame based on the path
    // This needs to be implemented based on how your data is structured within the frame
    return [];
  }
  private getDocs(resultsData: any, dataPath: string): any[] {
    if (!resultsData) {
      throw 'resultsData was null or undefined';
    }
    let data = dataPath.split('.').reduce((d: any, p: any) => {
      if (!d) {
        return null;
      }
      return d[p];
    }, resultsData.data);
    if (!data) {
      const errors: any[] = resultsData.errors;
      if (errors && errors.length !== 0) {
        throw errors[0];
      }
      throw 'Your data path did not exist! dataPath: ' + dataPath;
    }
    if (resultsData.errors) {
      // There can still be errors even if there is data
      console.log('Got GraphQL errors:');
      console.log(resultsData.errors);
    }
    const docs: any[] = [];
    let pushDoc = (originalDoc: object) => {
      docs.push(flatten(originalDoc));
    };
    if (Array.isArray(data)) {
      for (const element of data) {
        pushDoc(element);
      }
    } else {
      pushDoc(data);
    }
    return docs;
  }

   myAnnotationsQuery(options: any){
    const query = defaults(options.annotation, defaultQuery);
    return Promise.all([this.createQuery(query, options.range)]).then((results: any) => {
      const r: AnnotationEvent[] = [];
      for (const res of results) {
        const { timePath, endTimePath, timeFormat } = res.query;
        const dataPathArray: string[] = MyDataSource.getDataPathArray(res.query.dataPath);
        for (const dataPath of dataPathArray) {
          const docs: any[] = this.getDocs(res.results.data, dataPath);
          for (const doc of docs) {
            const annotation: AnnotationEvent = {};
            if (timePath in doc) {
              annotation.time = dateTime(doc[timePath], timeFormat).valueOf();
            }
            if (endTimePath in doc) {
              annotation.isRegion = true;
              annotation.timeEnd = dateTime(doc[endTimePath], timeFormat).valueOf();
            }
            let title = query.annotationTitle;
            let text = query.annotationText;
            let tags = query.annotationTags;
            for (const fieldName in doc) {
              const fieldValue = doc[fieldName];
              const replaceKey = 'field_' + fieldName;
              const regex = new RegExp('\\$' + replaceKey, 'g');
              title = title.replace(regex, fieldValue);
              text = text.replace(regex, fieldValue);
              tags = tags.replace(regex, fieldValue);
            }

            annotation.title = title;
            annotation.text = text;
            const tagsList: string[] = [];
            for (const element of tags.split(',')) {
              const trimmed = element.trim();
              if (trimmed) {
                tagsList.push(trimmed);
              }
            }
            annotation.tags = tagsList;
            r.push(annotation);
          }
        }
      }
      return r;
    });
  }
  private static getDataPathArray(dataPathString: string): string[] {
    const dataPathArray: string[] = [];
    for (const dataPath of dataPathString.split(',')) {
      const trimmed = dataPath.trim();
      if (trimmed) {
        dataPathArray.push(trimmed);
      }
    }
    if (!dataPathArray) {
      throw 'data path is empty!';
    }
    return dataPathArray;
  }

  async query(options: DataQueryRequest<MyQuery>): Promise<DataQueryResponse> {
    return Promise.all(
      options.targets.map((target) => {
        return this.createQuery(defaults(target, defaultQuery), options.range, options.scopedVars);
      })
    ).then((results: any) => {
      const dataFrameArray: DataFrame[] = [];
      for (let res of results) {
        const dataPathArray: string[] = this.getDataPathArray(res.query.dataPath);
        const { timePath, timeFormat, groupBy, aliasBy } = res.query;
        const split = groupBy.split(',');
        const groupByList: string[] = [];
        for (const element of split) {
          const trimmed = element.trim();
          if (trimmed) {
            groupByList.push(trimmed);
          }
        }
        for (const dataPath of dataPathArray) {
          const docs: any[] = this.getDocs(res.results.data, dataPath);

          const dataFrameMap = new Map<string, DataFrame>();
          for (const doc of docs) {
            if (timePath in doc) {
              doc[timePath] = dateTime(doc[timePath], timeFormat);
            }
            const identifiers: string[] = [];
            for (const groupByElement of groupByList) {
              identifiers.push(doc[groupByElement]);
            }
            const identifiersString = identifiers.toString();
            
            let dataFrame = dataFrameMap.get(identifiersString);

            if (!dataFrame) {
              // we haven't initialized the dataFrame for this specific identifier that we group by yet
              let dataFrame: DataFrame =  new MutableDataFrame({ fields:[] });
              const generalReplaceObject: any = {};
              for (const fieldName in doc) {
                generalReplaceObject['field_' + fieldName] = doc[fieldName];
              }
              for (const fieldName in doc) {
                let t: FieldType = FieldType.string;
                if (fieldName === timePath || isRFC3339_ISO6801(String(doc[fieldName]))) {
                  t = FieldType.time;
                } else if (_.isNumber(doc[fieldName])) {
                  t = FieldType.number;
                }
                let title;
                if (identifiers.length !== 0) {
                  // if we have any identifiers
                  title = identifiersString + '_' + fieldName;
                } else {
                  title = fieldName;
                }
                if (aliasBy) {
                  title = aliasBy;
                  const replaceObject = { ...generalReplaceObject };
                  replaceObject['fieldName'] = fieldName;
                  for (const replaceKey in replaceObject) {
                    const replaceValue = replaceObject[replaceKey];
                    const regex = new RegExp('\\$' + replaceKey, 'g');
                    title = title.replace(regex, replaceValue);
                  }
                  title = replaceTemplateVariables(title, options.scopedVars);
                }

                
                dataFrame.fields.push({
                  name: fieldName,
                  type: t,
                  config: { displayName: title },
                  values:[doc]
                })
                
              }
              dataFrameMap.set(identifiersString, dataFrame);
            }
            else{
              dataFrame.fields.values.apply(doc);
            }
          }
          for (const dataFrame of dataFrameMap.values()) {
            dataFrameArray.push(dataFrame);
          }
        }
      }
      return { data: dataFrameArray };
    });
  }
  

 public testDatasource(): Promise<TestDataSourceResponse> {
    console.log("here");
    alert("Here");
    const q = "{__schema{queryType{name}}}";
    let response = new TestResponse();
    return this.postQuery(defaultQuery, q).then(
      (res: any) => {
        if (res.errors) {
          response.setError(res.errors);
          console.log(res.errors);
          response.setStatus('error');
          response.setMessage('GraphQL Error: ' + res.errors[0].message);
          return response;
        }
        response.setStatus('success');
        response.setMessage('Success');
        return response;
      },
      (err: any) => {
        console.log(err);
        response.setError(err);
        response.setStatus('error');
        response.setMessage('HTTP Response ' + err.status + ': ' + err.statusText);
        return response;
      }
    );
  }

  async metricFindQuery(query: MyVariableQuery, options?: any) {
    const metricFindValues: MetricFindValue[] = [];

    query = defaults(query, defaultQuery);

    let payload = query.queryText;
    payload = replaceTemplateVariables(payload, { ...this.getVariables });

    const response = await this.postQuery(query, payload);

    const docs: any[] = this.getDocs(response.results.data, query.dataPath);

    for (const doc of docs) {
      if ('__text' in doc && '__value' in doc) {
        metricFindValues.push({ text: doc['__text'], value: doc['__value'] });
      } else {
        for (const fieldName in doc) {
          metricFindValues.push({ text: doc[fieldName] });
        }
      }
    }

    return metricFindValues;
  }

  getVariables() {
    const variables: {[id: string]: TextValuePair } = {};
    Object.values(getTemplateSrv().getVariables()).forEach((variable) => {
      if (!supportedVariableTypes.includes(variable.type)) {
        console.warn(`Variable of type "${variable.type}" is not supported`);
        return;
      }

      const supportedVariable = variable as MultiValueVariable;

      let variableValue = supportedVariable.current.value;
      if (variableValue === '$__all' || _.isEqual(variableValue, ['$__all'])) {
        if (supportedVariable.allValue === null || supportedVariable.allValue === '') {
          variableValue = supportedVariable.options.slice(1).map((textValuePair) => textValuePair.value);
        } else {
          variableValue = supportedVariable.allValue;
        }
      }
      variables[supportedVariable.id] = {
        text: supportedVariable.current.text,
        value: variableValue,
      };
    });
    return variables;
  }
}
