#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Wso2EiBusinessProcessStack } from '../lib/wso2ei-business-process-stack';

const app = new cdk.App();
new Wso2EiBusinessProcessStack(app, 'Wso2EiBusinessProcessStack', {
    env: { account: '737327749629', region: 'us-east-1' },
    stackName: 'wso2ei-business-process',
    description: 'Business Process Server profile instance'
});