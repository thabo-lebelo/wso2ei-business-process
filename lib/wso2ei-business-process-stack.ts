import { Stack, StackProps, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import { ApplicationProtocol } from 'aws-cdk-lib/aws-elasticloadbalancingv2';

export class Wso2EiBusinessProcessStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        // VPC and LB

        const vpc = ec2.Vpc.fromLookup(this, 'VPC', {
            vpcName: 'Blog',
        });

        // Cluster to deploy resources to
        const cluster = new ecs.Cluster(this, "Cluster", {
            vpc: vpc,
            clusterName: "wso2ei-business-process",
        });

        const alb = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
            vpc: vpc,
            internetFacing: true,
            loadBalancerName: 'WSO2'
        });

        /* DNS, DOMAINS, CERTS */
        // I'm using a domain I own: thabolebelo.com
        const zone = route53.HostedZone.fromLookup(this, 'HostedZone', {
            domainName: 'thabolebelo.com'
        });

        const cert = new acm.Certificate(this, 'thabolebelo', {
            domainName: 'wso2.thabolebelo.com',
            subjectAlternativeNames: ['*.wso2.thabolebelo.com'],
            validation: acm.CertificateValidation.fromDns(zone)
        });

        // Create DNS record to point to the load balancer
        new route53.ARecord(this, 'DNS', {
            zone: zone,
            target: route53.RecordTarget.fromAlias(
                new route53Targets.LoadBalancerTarget(alb)
            ),
            ttl: Duration.seconds(300),
            comment: 'URL to access the instance',
            recordName: 'wso2'
        });

        // Docker repo for bps image
        const repo = ecr.Repository.fromRepositoryArn(this, "Repo",
            "arn:aws:ecr:us-east-1:737327749629:repository/wso2ei-business-process"
        );
        const image = ecs.ContainerImage.fromEcrRepository(repo, 'latest')

        // Task definition
        const task = new ecs.TaskDefinition(this, 'TaskDef', {
            cpu: "512",
            memoryMiB: "1024",
            compatibility: ecs.Compatibility.EC2_AND_FARGATE,
            networkMode: ecs.NetworkMode.AWS_VPC,
        });

         // The docker container including the image to use
         const container = task.addContainer('Container', {
            memoryLimitMiB: 1024,
            image: image,
            logging: ecs.LogDriver.awsLogs({ streamPrefix: "wso2" })
        });

        container.addPortMappings({
            containerPort: 9445,
            protocol: ecs.Protocol.TCP
        });

        container.addPortMappings({
            containerPort: 9765,
            protocol: ecs.Protocol.TCP
        });

        // create service
        const service = new ecs.FargateService(this, "Service", {
            cluster: cluster,
            taskDefinition: task,
            serviceName: 'WSO2',
        });

        /* CONFIGURE ALB DEFAULT LISTENERS */
        const listener = alb.addListener('port9445Listener', { 
            port: 9445,
            certificates: [cert],
            protocol: elbv2.ApplicationProtocol.HTTPS
        });
        
        // Add target group to container
        listener.addTargets('service', {
            port: 9445,
            targets: [service],
            protocol: elbv2.ApplicationProtocol.HTTPS,
            targetGroupName: 'WSO2',
            healthCheck: {
                path: '/services/Version',
                protocol: elbv2.Protocol.HTTPS,
                unhealthyThresholdCount: 3
            }
        });

    }
}
