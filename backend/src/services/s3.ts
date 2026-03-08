import AWS from 'aws-sdk';
import { config } from '../config';

const s3 = new AWS.S3({
  accessKeyId: config.aws.accessKeyId,
  secretAccessKey: config.aws.secretAccessKey,
  region: config.aws.region,
});

export function getSignedUploadUrl(key: string, contentType: string): Promise<string> {
  return new Promise((resolve, reject) => {
    s3.getSignedUrl(
      'putObject',
      {
        Bucket: config.aws.s3Bucket,
        Key: key,
        ContentType: contentType,
        Expires: 3600,
      },
      (err, url) => (err ? reject(err) : resolve(url))
    );
  });
}

export function getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
  return new Promise((resolve, reject) => {
    s3.getSignedUrl(
      'getObject',
      {
        Bucket: config.aws.s3Bucket,
        Key: key,
        Expires: expiresIn,
      },
      (err, url) => (err ? reject(err) : resolve(url))
    );
  });
}

export function getPublicUrl(key: string): string {
  return `https://${config.aws.s3Bucket}.s3.${config.aws.region}.amazonaws.com/${key}`;
}
