declare module 'minio' {
  export interface ClientOptions {
    endPoint: string;
    port?: number;
    useSSL?: boolean;
    accessKey: string;
    secretKey: string;
  }

  export interface ItemBucketMetadata {
    [key: string]: string;
  }

  export interface BucketObject {
    name: string;
    prefix?: string;
    size?: number;
    etag?: string;
    lastModified?: Date;
  }

  export class Client {
    constructor(options: ClientOptions);
    makeBucket(bucketName: string, region?: string): Promise<void>;
    bucketExists(bucketName: string): Promise<boolean>;
    fPutObject(bucketName: string, objectName: string, filePath: string, metaData?: ItemBucketMetadata): Promise<string>;
    fGetObject(bucketName: string, objectName: string, filePath: string): Promise<void>;
    removeObject(bucketName: string, objectName: string): Promise<void>;
    removeObjects(bucketName: string, objectsList: string[]): Promise<void>;
    presignedGetObject(bucketName: string, objectName: string, expires?: number, respHeaders?: ItemBucketMetadata): Promise<string>;
    listObjects(bucketName: string, prefix?: string, recursive?: boolean): AsyncIterable<BucketObject>;
    getBucketPolicy(bucketName: string): Promise<any>;
    setBucketPolicy(bucketName: string, policy: any): Promise<void>;
  }
}
