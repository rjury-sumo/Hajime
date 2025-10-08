/**
 * Parser snippets from Sumo Logic apps
 * Auto-generated from reference data - one parser per app
 */
export interface ParserSnippet {
    parser: string;
    app: string;
}

export const PARSER_SNIPPETS: ParserSnippet[] = [
  {
    "parser": "| json \"userIdentity\", \"eventTime\", \"eventSource\", \"eventName\", \"awsRegion\", \"sourceIPAddress\", \"userAgent\", \"errorCode\", \"requestParameters\", \"eventType\" as userIdentity, event_time, eventSource, event.action, cloud.region, client.ip, user_agent, event.outcome, requestParameters, eventType nodrop\n| json field=userIdentity \"type\", \"accountId\" as userType, cloud.account.id\n| json field=requestParameters \"bucketName\" as cloud.instance.id\n| parse field=eventSource \"*.\" as cloud.service.name\n| parse regex \"\\\"(?i)userName\\\":\\\"(?<user_name>.*?)\\\"\" nodrop\n| parse \"\\\"userId\\\":\\\"*\\\"\" as user_id nodrop",
    "app": ""
  },
  {
    "parser": "| json \"timestamp\", \"user.name\", \"client.app_name\", \"client.platform_name\", \"client.platform_version\", \"client.os_name\", \"client.os_version\", \"client.ip_address\", \"location.country\", \"location.region\", \"location.city\", \"action\", \"vault_uuid\", \"item_uuid\" as timestamp, user_name, client_app_name, client_platform, client_platform_version, client_os, client_os_version, client_ip, country, region, city, action, vault_uuid, item_uuid",
    "app": "1Password"
  },
  {
    "parser": "| json \"event.severity_level\", \"event.caseId\", \"event.description\", \"sourcetype\" as severity, case_id, description, source_type nodrop",
    "app": "Abnormal Security"
  },
  {
    "parser": "| parse \"\\\"host\\\":\\\"*\\\",\" as host nodrop",
    "app": "Acquia"
  },
  {
    "parser": "| json  \"computer\", \"keywords\" as host.name, keywords nodrop",
    "app": "Active Directory 2012+ - OpenTelemetry"
  },
  {
    "parser": "| json \"EventID\", \"Computer\", \"Keywords\" as event_id, host, keywords nodrop",
    "app": "Active Directory 2012+ (JSON)"
  },
  {
    "parser": "| json \"EventID\", \"Computer\", \"Keywords\" as event_id, host, keywords nodrop",
    "app": "Active Directory JSON"
  },
  {
    "parser": "| parse regex \"^OU SearchBase==\\\"(?<searchBase>[^\\\"]+)\\\" DistinguishedName==\\\"(?<ouDN>[^\\\"]+)\\\" Name==\\\"(?<ouName>[^\\\"]+)\\\" ObjectGUID==\\\"(?<ouGUID>[^ ]+)\\\"\"\n| searchBase as domain\n|",
    "app": "Active Directory Legacy"
  },
  {
    "parser": "| parse  field=destinationName * as topic\n|",
    "app": "ActiveMQ"
  },
  {
    "parser": "| parse \"*\n| *\n| *\" as datetime,severity,msg",
    "app": "ActiveMQ - OpenTelemetry"
  },
  {
    "parser": "| Json \"enterpriseaccountid\", \"originatinguserid\", \"apiname\", \"apiversion\", \"actionid\", \"client.ipaddress\", \"request.requestid\", \"request.starttime\", \"request.modelclassname\", \"request.modelid\", \"request.action\", \"response.success\" as enterprise_account_id, originating_user_id, api_name, api_version, action_id, ipaddress, requestid, starttime, modelclassname, modelid, action, success nodrop",
    "app": "Airtable"
  },
  {
    "parser": "| parse \"\\\"UA\\\":\\\"*\\\"\" as ua",
    "app": "Akamai Cloud Monitor"
  },
  {
    "parser": "| json \"version\", \"streamId\", \"cp\", \"reqId\", \"reqTimeSec\", \"bytes\", \"cliIP\", \"statusCode\", \"proto\", \"reqHost\", \"reqMethod\", \"reqPath\", \"reqPort\", \"rspContentLen\", \"rspContentType\", \"UA\", \"tlsOverheadTimeMSec\", \"tlsVersion\", \"objSize\", \"uncompressedSize\", \"overheadBytes\", \"totalBytes\", \"queryStr\", \"breadcrumbs\", \"accLang\", \"cookie\", \"range\", \"referer\", \"xForwardedFor\", \"maxAgeSec\", \"reqEndTimeMSec\", \"errorCode\", \"turnAroundTimeMSec\", \"transferTimeMSec\", \"dnsLookupTimeMSec\", \"lastByte\", \"edgeIP\", \"country\", \"state\", \"city\", \"serverCountry\", \"billingRegion\", \"cacheStatus\", \"securityRules\", \"ewUsageInfo\", \"ewExecutionInfo\", \"customField\" as  version, streamId, cp, reqId, reqTimeSec, bytes, cliIP, statusCode, proto, reqHost, reqMethod, reqPath, reqPort, rspContentLen, rspContentType, UA, tlsOverheadTimeMSec, tlsVersion, objSize, uncompressedSize, overheadBytes, totalBytes, queryStr, breadcrumbs, accLang, cookie, range, referer, xForwardedFor, maxAgeSec, reqEndTimeMSec, errorCode, turnAroundTimeMSec, transferTimeMSec, dnsLookupTimeMSec, lastByte, edgeIP, country, state, city, serverCountry, billingRegion, cacheStatus, securityRules, ewUsageInfo, ewExecutionInfo, customField",
    "app": "Akamai DataStream"
  },
  {
    "parser": "| json field=_raw \"attackData.clientIP\" as client_ip",
    "app": "Akamai Security Events"
  },
  {
    "parser": "| json   \"extra.status\", \"extra.class\", \"incident.threatRating\", \"updatetime_str\", \"victim\", \"attacker\", \"incident.recommendations\", \"incident.description\",\"incident.summary\", \"incidentId\",  \"asset_deployment_type\", \"customer\", \"accountId\" as status,  incident_class, threat_rating, timestamp, victim, attacker, recommendations, description, summary, incident_id, deployment_name, customer_name, account_id  nodrop\n| json \"extra.target_host\", \"extra.investigation_report\", \"extra.class\", \"extra.incidentUrl\", \"mitre_classification[*].technique\", \"mitre_classification[*].tactic\" as target_host, investigation_report, incident_class, incident_url, mitre_technique, mitre_tactic nodrop\n| json field=attacker \"ip\" as attacker_ip",
    "app": "Alert Logic"
  },
  {
    "parser": "| json \"logStream\", \"logGroup\", \"message\" as logStream, logGroup, msg\n| parse field=msg \"* * * * * * * * * * * * * *\" as version, account_id, interface_id, src_ip, dest_ip, src_port, dest_port, Protocol, packets, bytes, start, end,action,log_status",
    "app": "Alex Amazon VPC Flow"
  },
  {
    "parser": "| parse \"*\\t*\\t*\\t*\\t*\\t*\\t*\\t*\\t*\\t*\\t*\\t*\\t*\\t*\\t*\" as _filedate,time,edgeloc, scbytes, c_ip,method,cs_host,uri_stem,status,referer,user_agent,uri_query,cookie,edgeresult,requestid",
    "app": "Amazon CloudFront"
  },
  {
    "parser": "| parse \"\\\"eventName\\\":\\\"*\\\"\" as event_name",
    "app": "Amazon CloudTrail - Cloud Security Monitoring and Analytics"
  },
  {
    "parser": "| json \"message\" nodrop\n| if (!isblank(message), message, _raw) as log\n| json field=log \"level\" as level",
    "app": "Amazon EKS - Control Plane"
  },
  {
    "parser": "| json \"severity\"\n| json field=_raw \"accountId\", \"region\", \"partition\", \"id\", \"arn\", \"type\",\"service.serviceName\",\"service.detectorId\",\"service.action\",\"title\",\"description\" nodrop\n| parse field=type \"*:*/*\" as ThreatPurpose,ResourceType,ThreatName\n| json field=%service.action \"networkConnectionAction.remoteIpDetails.ipAddressV4\",\"networkConnectionAction.localPortDetails.port\" as ip, localPort nodrop\n| parse \"\\\"vpcId\\\":\\\"*\\\"\" as vpcId, \"\\\"subnetId\\\":\\\"*\\\"\" as subnetId,\"\\\"groupId\\\":\\\"*\\\"\" as securityGroupId,\"\\\"tags\\\":[*]\" as tags,\"\\\"groupName\\\":\\\"*\\\"\" as securityGroupName nodrop\n| json field=_raw \"resource.instanceDetails.instanceId\" as instanceid nodrop",
    "app": "Amazon GuardDuty - Cloud Security Monitoring and Analytics"
  },
  {
    "parser": "| json  \"AwsAccountId\", \"Id\", \"GeneratorId\", \"ProductArn\", \"CreatedAt\", \"UpdatedAt\", \"Resources\", \"Severity.Normalized\", \"SourceUrl\", \"Title\",\"Types\", \"Compliance.Status\" as aws_account_id, finding_id, generator_id, product_arn, created_at, updated_at, resources, severity_normalized, sourceurl, title, finding_types, compliance_status nodrop\n| parse regex field=product_arn \"product/(?<finding_provider>.*?)$\"",
    "app": "Amazon Inspector"
  },
  {
    "parser": "| json \"Message\" as rawMsg\n| json field=rawMsg \"event\",\"target\",\"run\",\"template\",\"targetLookup.name\",\"runLookup.name\",\"templateLookup.name\" nodrop",
    "app": "Amazon Inspector Classic"
  },
  {
    "parser": "| json field=_raw \"eventSource\", \"eventName\", \"awsRegion\", \"sourceIPAddress\",\"userAgent\" nodrop\n| json field=_raw \"requestParameters.streamName\" as streamName nodrop\n| json field=_raw \"userIdentity.sessionContext.sessionIssuer.userName\" as userName nodrop",
    "app": "Amazon Kinesis - Streams"
  },
  {
    "parser": "| parse regex \"^(?<event>[\\w]+[\\w\\s]*)\\\n| (?<eventDetails>.*)\"\n| parse \"*\n| *\n| *\n| *\n| *\n| *\n| *\n| *\n| *\n| *\n| *\n| *\n| *\n| *\n| *\n| *\" as event, recordtime, remotehost, remoteport, pid, dbname, username, authmethod, duration, sslversion, sslcipher, mtu, sslcompression, sslexpansion, something1, application_name",
    "app": "Amazon Redshift ULM"
  },
  {
    "parser": "| json field=raw \"labels[*].name\" as label_name",
    "app": "Amazon Route 53 Resolver Security"
  },
  {
    "parser": "| parse \"* * [*] * * * * * \\\"* HTTP/1.1\\\" * * * * * * * \\\"*\\\" *\" as bucket_owner, bucket, time, remoteIP, requester, request_ID, operation, key, request_URI, status_code, error_code, bytes_sent, object_size, total_time, turn_time, referrer, user_agent, version_ID",
    "app": "Amazon S3 Audit"
  },
  {
    "parser": "| json \"notificationType\" nodrop\n| json \"mail.source\" as mailSource nodrop\n| json \"mail.sourceIp\" as mailSourceIP nodrop\n| json \"mail.sendingAccountId\" as mailSendingAccountId nodrop",
    "app": "Amazon SES"
  },
  {
    "parser": "| json \"eventName\" nodrop\n| json \"eventSource\" nodrop\n| json \"errorCode\" nodrop\n| json \"awsRegion\" nodrop\n| json \"sourceIPAddress\" nodrop\n| json \"userIdentity.accountId\" as accountId nodrop\n| json \"userIdentity.arn\" as arn nodrop\n| parse field=arn \":assumed-role/*\" as user nodrop\n| json \"userIdentity.userName\" as username nodrop",
    "app": "Amazon SNS"
  },
  {
    "parser": "| json \"eventName\" nodrop\n| json \"eventSource\" nodrop\n| json \"requestParameters.queueName\" as queueName nodrop\n| json \"requestParameters.queueUrl\" as queueUrl nodrop\n| json \"userIdentity.accountId\" as accountId nodrop",
    "app": "Amazon SQS"
  },
  {
    "parser": "| json \"logStream\", \"logGroup\", \"message\", \"direction\" as logStream, logGroup, message, direction nodrop\n| parse field=message \"* * * * * * * * * * * * * *\" as version,accountID,interfaceID,srcDevice_ip,dstDevice_ip,src_port,dest_port,Protocol,Packets,bytes,StartSample,EndSample,Action,status",
    "app": "Amazon VPC Flow - Cloud Security Monitoring and Analytics"
  },
  {
    "parser": "| json \"log\" nodrop\n| if (_raw matches \"{*\", log, _raw) as mesg\n| parse regex field=mesg \" \\[(?<log_level>[a-z]+)\\] \" nodrop\n| parse regex field=mesg \" \\[(?<module>[a-z-_]+):(?<log_level>[a-z]+)\\] \" nodrop",
    "app": "Apache"
  },
  {
    "parser": "| json \"log\" nodrop\n| if (_raw matches \"{*\", log, _raw) as mesg\n| parse regex field=mesg \" \\[(?<log_level>[a-z]+)\\] \" nodrop\n| parse regex field=mesg \" \\[(?<module>[a-z-_]+):(?<log_level>[a-z]+)\\] \" nodrop",
    "app": "Apache - OpenTelemetry"
  },
  {
    "parser": "| json \"log\" as _rawlog nodrop",
    "app": "Apache Tomcat"
  },
  {
    "parser": "| json \"log\" as _rawlog nodrop",
    "app": "Apache Tomcat - OpenTelemetry"
  },
  {
    "parser": "| json \"rule_type\", \"result\", \"category\" nodrop",
    "app": "Aqua Security"
  },
  {
    "parser": "| parse \"\\\"hostName\\\":\\\"*\\\",\\\"product\\\":\\\"*\\\",\\\"metaData\\\":{\\\"flowID\\\":*,\\\"flowStart\\\":*,\\\"flowEnd\\\":*,\\\"pktsSent\\\":*,\\\"pktsRcvd\\\":*,\\\"bytesSent\\\":*,\\\"bytesRcvd\\\":*,\\\"srcMac\\\":\\\"*\\\",\\\"dstMac\\\":\\\"*\\\",\\\"vlanId\\\":*,\\\"srcIP\\\":\\\"*\\\",\\\"dstIP\\\":\\\"*\\\",\\\"srcTOS\\\":*,\\\"dstTOS\\\":*,\\\"l4Proto\\\":*,\\\"srcPort\\\":*,\\\"dstPort\\\":*,\\\"tcpFlags\\\":*}}\" as HostName,Product,FlowID,FlowStart,FlowEnd,PktsSent,PktsRcvd,BytesSent,BytesRcvd,SrcMac,DstMac,VlanID,SrcIP,DstIP,SrcTos,DstTos,Protocol,SrcPort,DstPort,TcpFlags",
    "app": "ARIA Packet Intelligence"
  },
  {
    "parser": "| json \"id\",\"name\",\"manufacturer\",\"model\",\"riskLevel\",\"sensor\",\"site.name\",\"type\",\"category\",\"operatingSystem\" as id, name, manufacturer, model, riskLevel, sensor, site, type, category, operatingSystem nodrop",
    "app": "Armis"
  },
  {
    "parser": "| parse \"[*] *:* for */*\" as what, repo, path, user, ip\n| parse regex field=ip \"(?<ip>.*)\\.\"",
    "app": "Artifactory 7"
  },
  {
    "parser": "| parse regex \"^.*\\)(?: -\n| )(?<repo>[\\w-]*)\\s+(?<action>\\w*)\"\n| parse \"downloaded  * * * at * KB/sec\" as artifact, size, unit, rate",
    "app": "Artifactory 7 - OpenTelemetry"
  },
  {
    "parser": "| json \"gid\",\"event_type\",\"resource.name\",\"resource.email\",\"resource.resource_type\",\"event_category\", \"created_at\", \"actor.name\", \"actor.email\",\"context.client_ip_address\" as gid, event_type, resource_name, resource_email, resource_type, event_category, created_at, actor_name, actor_email, ip nodrop",
    "app": "Asana"
  },
  {
    "parser": "| json  \"action\"",
    "app": "Atlassian"
  },
  {
    "parser": "| parse \"exported * \\\"*\\\"\" as content_type,content_name",
    "app": "Audit"
  },
  {
    "parser": "| json \"userIdentity\", \"eventSource\", \"eventName\", \"awsRegion\", \"sourceIPAddress\", \"userAgent\", \"eventType\", \"recipientAccountId\", \"requestParameters\", \"responseElements\", \"requestID\", \"errorCode\", \"errorMessage\" nodrop\n| json field=userIdentity \"type\", \"principalId\", \"arn\", \"userName\", \"accountId\" nodrop\n| json field=userIdentity \"sessionContext.attributes.mfaAuthenticated\" as mfaAuthenticated nodrop\n| json field=requestParameters \"dBClusterIdentifier\", \"engine\", \"engineMode\" as req_dBClusterIdentifier, req_engine, req_engineMode nodrop\n| json field=responseElements \"dBClusterIdentifier\", \"engine\", \"engineMode\" as res_dBClusterIdentifier, res_engine, res_engineMode nodrop\n| parse field=arn \":assumed-role/*\" as user nodrop\n| parse field=arn \"arn:aws:iam::*:*\" as accountId, user nodrop",
    "app": "Aurora PostgreSQL ULM"
  },
  {
    "parser": "| json \"sourceIPAddress\"",
    "app": "AWS CloudTrail"
  },
  {
    "parser": "| json \"Message\", \"Type\"\n| json field=message \"messageType\",\"configurationItem\" as messageType, single_message\n| json field=single_message \"resourceId\", \"resourceType\", \"awsRegion\", \"awsAccountId\", \"configurationItemStatus\"",
    "app": "AWS Config"
  },
  {
    "parser": "| json \"region\", \"CostUsd\", \"CostType\", \"StartDate\", \"EndDate\", \"MetricType\", \"Granularity\", \"Estimated\"",
    "app": "AWS Cost Explorer"
  },
  {
    "parser": "| json field=_raw \"message\", \"message.level\" as log, level",
    "app": "AWS EKS - Control Plane"
  },
  {
    "parser": "| parse \"* * * * * * * * * * * * \\\"*\\\" \\\"*\\\" * * * \\\"*\\\"\" as type, datetime, ELB_Server, client, backend, request_processing_time, target_processing_time, response_processing_time, elb_status_code, target_status_code, received_bytes, sent_bytes, request,user_agent,ssl_cipher,ssl_protocol,target_group_arn,trace_id\n| parse field=request \"* *://*:*/* HTTP\" as method, protocol, domain, server_port, uri\n| parse field=target_group_arn \"arn:* \" as target_group_arn nodrop",
    "app": "AWS Elastic Load Balancer - Application"
  },
  {
    "parser": "| json field=_raw \"accountId\", \"region\", \"partition\", \"id\", \"arn\", \"type\",\"service.serviceName\",\"service.detectorId\",\"service.action\",\"severity\",\"title\",\"description\" nodrop\n| parse field=type \"*:*/*\" as ThreatPurpose,ResourceType,ThreatName\n| json field=%service.action \"networkConnectionAction.remoteIpDetails.ipAddressV4\",\"networkConnectionAction.localPortDetails.port\" as ip, localPort nodrop\n| parse \"\\\"vpcId\\\":\\\"*\\\"\" as vpcId, \"\\\"subnetId\\\":\\\"*\\\"\" as subnetId,\"\\\"groupId\\\":\\\"*\\\"\" as securityGroupId,\"\\\"tags\\\":[*]\" as tags,\"\\\"groupName\\\":\\\"*\\\"\" as securityGroupName nodrop\n| json field=_raw \"resource.instanceDetails.instanceId\" as instanceid nodrop",
    "app": "AWS GuardDuty"
  },
  {
    "parser": "| json field=_raw \"id\", \"type\",\"severity\" ,\"title\",\"description\"\n| parse field=type \"*:*/*\" as threatpurpose, resource, threatname",
    "app": "AWS GuardDuty Benchmark"
  },
  {
    "parser": "| json \"message\"\n| parse field=logstream \"*/[*]*\" as logstreamDate,version,logstreamID\n| parse field=loggroup \"/aws/lambda/*\" as function",
    "app": "AWS Lambda"
  },
  {
    "parser": "| json \"message\"\n| parse field=logstream \"*/[*]*\" as logstreamDate,version,logstreamID\n| parse field=loggroup \"/aws/lambda/*\" as functionName\n| parse field=message \"*\\t*\\t*\" as time,RequestId,errorObj",
    "app": "AWS Lambda ULM"
  },
  {
    "parser": "| json \"firewall_name\", \"availability_zone\", \"event\" nodrop\n| json field=event \"event_type\", \"src_ip\", \"src_port\", \"dest_ip\", \"dest_port\", \"app_proto\", \"proto\", \"alert\" nodrop",
    "app": "AWS Network Firewall"
  },
  {
    "parser": "| json  \"AwsAccountId\", \"Id\", \"GeneratorId\", \"ProductArn\", \"CreatedAt\", \"UpdatedAt\", \"Resources\", \"Severity.Normalized\", \"SourceUrl\",\n| parse regex field=finding_types \"\\\"(?<finding_type>.*?)\\\"\" multi\n| parse regex field=resources \"\\\"Type\\\":\\\"(?<resource_type>.*?)\\\"\" multi\n| parse regex field=resources \"\\\"Id\\\":\\\"(?<resource_id>.*?)\\\"\" multi",
    "app": "AWS Security Hub"
  },
  {
    "parser": "| json  \"AwsAccountId\", \"Id\", \"GeneratorId\", \"ProductArn\", \"CreatedAt\", \"UpdatedAt\", \"Resources\", \"Severity.Normalized\", \"SourceUrl\", \"Title\",\"Types\", \"Compliance.Status\" as aws_account_id, finding_id, generator_id, product_arn, created_at, updated_at, resources, severity_normalized, sourceurl, title, finding_types, compliance_status nodrop\n| parse regex field=product_arn \"product/(?<finding_provider>.*?)$\"",
    "app": "AWS Security Hub - Cloud Security Monitoring and Analytics"
  },
  {
    "parser": "| json \"notificationType\" nodrop\n| json \"bounce.bounceSubType\" as bounceSubType nodrop\n| json \"bounce.bounceType\" as bounceType nodrop\n| json \"bounce.bouncedRecipients\" as bouncedRecipients nodrop\n| parse regex field=bouncedRecipients \"\\\"emailAddress\\\":\\\"(?<BouncedemailAddress>[^\\\"]*)\\\"\" multi\n| parse field=BouncedemailAddress \"*@*\" as name, domain",
    "app": "AWS SES"
  },
  {
    "parser": "| json \"message\"\n| parse field=message \"* * * * * * * * * * * * * *\" as version,accountID,interfaceID,src_ip,dest_ip,src_port,dest_port,Protocol,Packets,bytes,StartSample,EndSample,Action,status",
    "app": "AWS VPC Flow Logs"
  },
  {
    "parser": "| parse \"\\\"httpMethod\\\":\\\"*\\\",\" as httpMethod,\"\\\"httpVersion\\\":\\\"*\\\",\" as httpVersion,\"\\\"uri\\\":\\\"*\\\",\" as uri, \"{\\\"clientIp\\\":\\\"*\\\",\\\"country\\\":\\\"*\\\"\" as clientIp,country, \"\\\"action\\\":\\\"*\\\"\" as action, \"\\\"matchingNonTerminatingRules\\\":[*]\" as matchingNonTerminatingRules, \"\\\"rateBasedRuleList\\\":[*]\" as rateBasedRuleList, \"\\\"ruleGroupList\\\":[*]\" as ruleGroupList, \"\\\"httpSourceId\\\":\\\"*\\\"\" as httpSourceId, \"\\\"httpSourceName\\\":\\\"*\\\"\" as httpSourceName, \"\\\"terminatingRuleType\\\":\\\"*\\\"\" as terminatingRuleType, \"\\\"terminatingRuleId\\\":\\\"*\\\"\" as terminatingRuleId, \"\\\"webaclId\\\":\\\"*\\\"\" as webaclId",
    "app": "AWS WAF"
  },
  {
    "parser": "| parse \"\\\"httpMethod\\\":\\\"*\\\",\" as httpMethod,\"\\\"httpVersion\\\":\\\"*\\\",\" as httpVersion,\"\\\"uri\\\":\\\"*\\\",\" as uri, \"{\\\"clientIp\\\":\\\"*\\\",\\\"country\\\":\\\"*\\\"\" as clientIp,country, \"\\\"action\\\":\\\"*\\\"\" as action, \"\\\"matchingNonTerminatingRules\\\":[*]\" as matchingNonTerminatingRules, \"\\\"rateBasedRuleList\\\":[*]\" as rateBasedRuleList, \"\\\"ruleGroupList\\\":[*]\" as ruleGroupList, \"\\\"httpSourceId\\\":\\\"*\\\"\" as httpSourceId, \"\\\"httpSourceName\\\":\\\"*\\\"\" as httpSourceName, \"\\\"terminatingRuleType\\\":\\\"*\\\"\" as terminatingRuleType, \"\\\"terminatingRuleId\\\":\\\"*\\\"\" as terminatingRuleId, \"\\\"webaclId\\\":\\\"*\\\"\" as webaclId",
    "app": "AWS WAF - Cloud Security Monitoring and Analytics"
  },
  {
    "parser": "| json field=_raw \"operationName\" as operationName\n| json field=_raw \"category\" as category\n| json field=_raw \"Level\" as level\n| json field=_raw \"callerIpAddress\" as ip_addr",
    "app": "Azure Active Directory"
  },
  {
    "parser": "| JSON \"category\"",
    "app": "Azure API Management"
  },
  {
    "parser": "| json \"resultType\", \"category\", \"operationName\", \"resourceId\" as resultType, category, operationName, resourceid",
    "app": "Azure App Service Environment"
  },
  {
    "parser": "| json \"resultType\", \"category\", \"operationName\", \"resourceId\" as resultType, category, operationName, resourceid",
    "app": "Azure App Service Plan"
  },
  {
    "parser": "| JSON \"category\"",
    "app": "Azure Application Gateway"
  },
  {
    "parser": "| json \"resourceId\" as resourceId1 nodrop // EventHub\n| parse regex field=resourceId1 \"/RESOURCEGROUPS/(?<ResourceGroupName1>[^/]+)\" nodrop\n| json \"ResourceGroupName\" as ResourceGroupName2 nodrop // Azure Insight API using our Powershell scripts",
    "app": "Azure Audit"
  },
  {
    "parser": "| JSON \"category\"",
    "app": "Azure Cache for Redis"
  },
  {
    "parser": "| JSON \"category\"",
    "app": "Azure Cosmos DB"
  },
  {
    "parser": "| json \"resultType\", \"category\" as resultType, category",
    "app": "Azure Cosmos DB for PostgreSQL"
  },
  {
    "parser": "| JSON \"category\"",
    "app": "Azure Database for MySQL"
  },
  {
    "parser": "| JSON \"category\"",
    "app": "Azure Database for PostgreSQL"
  },
  {
    "parser": "| JSON \"category\"",
    "app": "Azure Event Grid"
  },
  {
    "parser": "| JSON \"category\", \"level\", \"resultSignature\",",
    "app": "Azure Functions"
  },
  {
    "parser": "| json \"properties.log\", \"category\", \"time\", \"properties.pod\", \"resourceId\" as log, category, time, pod, resourceId\n| parse regex field=log \"(?<severity>W\n| I\n| F\n| E)(?<tt>[\\S]+) (?<times>[\\d:.]+)[\\s]+(?<log_msg>.*)\"\n| parse regex field=resourceId \"RESOURCEGROUPS\\/(?<resource_grp>[\\S]+)\\/PROVIDERS\\/MICROSOFT\\.CONTAINERSERVICE\\/MANAGEDCLUSTERS\\/(?<cluster>[\\S]+)\"",
    "app": "Azure Kubernetes Service (AKS) - Control Plane"
  },
  {
    "parser": "| JSON \"category\", \"resultType\" as category, resultType",
    "app": "Azure Load Balancer"
  },
  {
    "parser": "| json field=_raw \"rule_name\"\n| json field=_raw \"resource_id\"\n| json field=_raw \"event_name\"\n| json field=_raw \"mac\"\n| json field=_raw \"src_ip\"\n| json field=_raw \"dest_IP\"\n| json field=_raw \"dest_port\"\n| json field=_raw \"protocol\"\n| json field=_raw \"traffic_destination\"\n| json field=_raw \"traffic_a/d\" as traffic_a_d\n| parse regex field=resource_id\"(?<NSG>[\\w-_.]+)$\"\n| json field=_raw \"src_port\"",
    "app": "Azure Network Watcher"
  },
  {
    "parser": "| JSON \"category\"",
    "app": "Azure Service Bus"
  },
  {
    "parser": "| JSON \"category\", \"level\", \"resultSignature\",",
    "app": "Azure SQL"
  },
  {
    "parser": "| json \"category\"",
    "app": "Azure Storage"
  },
  {
    "parser": "| JSON \"category\", \"level\", \"resultSignature\",",
    "app": "Azure Web Apps"
  },
  {
    "parser": "| parse regex \" (?<action>[\\S]*): type=(?<type>[^\n| ]*)\\\n| proto=(?<proto>[^\n| ]*)\\\n| srcIF=(?<srcif>[^\n| ]*)\\\n| srcIP=(?<src_ip>[^\n| ]*)\\\n| srcPort=(?<src_port>[^\n| ]*)\\\n| srcMAC=(?<srcmac>[^\n| ]*)\\\n| dstIP=(?<dest_ip>[^\n| ]*)\\\n| dstPort=(?<dest_port>[^\n| ]*)\\\n| dstService=(?<dstservice>[^\n| ]*)\\\n| dstIF=(?<dstif>[^\n| ]*)\\\n| rule=(?<rule>[^\n| ]*)\\\n| info=(?<info>[^\n| ]*)\\\n| srcNAT=(?<srcnat>[^\n| ]*)\\\n| dstNAT=(?<dstnat>[^\n| ]*)\\\n| duration=(?<duration>[^\n| ]*)\\\n| count=(?<count>[^\n| ]*)\\\n| receivedBytes=(?<receivedbytes>[^\n| ]*)\\\n| sentBytes=(?<sentbytes>[^\n| ]*)\\\n| receivedPackets=(?<receivedpackets>[^\n| ]*)\\\n| sentPackets=(?<sentpackets>[^\n| ]*)\\\n| user=(?<user>[^\n| ]*)\\\n| protocol=(?<protocol>[^\n| ]*)\\\n| application=(?<application>[^\n| ]*)\\\n| target=(?<target>[^\n| ]*)\\\n| content=(?<content>[^\n| ]*)\\\n| urlcat=(?<urlcat>[^\n| ]*)\",regex \" - (?<timestamp>[\\S]+) 1 (?<src_ip>[\\S]+) (?<dest_ip>[\\S]+) (?<content_type>[\\S]+) (?<srcip>[\\S]+) (?<uri>[\\S]+) (?<content_length>[\\S]+) BYF \\S+ \\S+  \\S+ \\S+ \\S+ \\S+ \\S+ \\(\\S+\\) \\S+ \\S+ \\S+ \\S+ \\S+ \\S+ \\S+ \\[(?<user>[^]]*)\\]\"\n| where !isEmpty(user)\n| replace(user,\"-\",\"Unauthenticated\")as %\"User\"",
    "app": "Barracuda CloudGen Firewall"
  },
  {
    "parser": "| parse regex \"(?<Unit_Name>[^ ]+) TR(?<Log>.*)\"\n| split Log delim=' ' extract 2 as Service_Ip, 3 as Service_Port",
    "app": "Barracuda WAF"
  },
  {
    "parser": "| json field=_raw \"buildNumber\", \"deploymentEnvironment\", \"branch\", \"repoFullName\", \"pipe_result_link\", \"deploy_status\", \"pr_id\", \"commit\", \"tag\", \"projectKey\", \"repoOwner\", \"commit_link\"",
    "app": "BitBucket"
  },
  {
    "parser": "| json \"event_type\" as event_type",
    "app": "Box"
  },
  {
    "parser": "| json field=_raw \"deviceInfo.deviceName\", \"device_name\" as Device1, Device2 nodrop",
    "app": "Carbon Black"
  },
  {
    "parser": "| parse regex field=process_name \"(?<process_name>[^\\\\//]*)$\"",
    "app": "Carbon Black Cloud"
  },
  {
    "parser": "| parse field=metric cassandra_java_GarbageCollector_*_LastGcInfo_memoryUsageAfterGc_*_used as unused, MemoryPoolName\n|",
    "app": "Cassandra"
  },
  {
    "parser": "| json \"log\" as _rawlog nodrop\n| parse regex field=mesg \" - (?<keyspace>[^.]*)\\.(?<table>[^ ]*) +(?<ops>[0-9]*),(?<data>[0-9]*)\"",
    "app": "Cassandra - OpenTelemetry"
  },
  {
    "parser": "| json \"account_id\", \"admin\", \"admin_id\", \"change_type\", \"creation_date\", \"insertion_date\", \"model_name\", \"model_type\", \"module\" as account_id, admin, admin_id, activity, creation_date, insertion_date, model_name, model_type, module nodrop",
    "app": "Cato Networks"
  },
  {
    "parser": "| json \"project.name\" as project\n| json \"job.number\"",
    "app": "CircleCI"
  },
  {
    "parser": "| json field=_raw \"awsRegion\" as region\n| json field=_raw \"userIdentity.accountId\" as acc_id\n| json field=_raw \"sourceIPAddress\" as ip_add\n| json field=_raw \"userIdentity.userName\" as user_name\n| json \"eventName\"",
    "app": "CIS AWS Foundations Benchmark"
  },
  {
    "parser": "| parse \" %*:\" as error",
    "app": "Cisco ASA"
  },
  {
    "parser": "| parse \"pattern: *\" as pattern nodrop",
    "app": "Cisco Meraki"
  },
  {
    "parser": "| json \"ts\", \"adminName\", \"adminEmail\", \"adminId\", \"page\", \"label\" as ts, admin_name, admin_email, admin_id, page, label nodrop",
    "app": "Cisco Meraki - C2C"
  },
  {
    "parser": "| parse \"\\\"*\\\",\\\"*\\\",\\\"*\\\",\\\"*\\\",\\\"*\\\",\\\"*\\\",\\\"*\\\",\\\"*\\\",\\\"*\\\"\" as  id, timestamp, email, user, type, action, ip, before, after",
    "app": "Cisco Umbrella"
  },
  {
    "parser": "| json \"recordId\",\"eventType\",\"targetDisplayName\",\"targetEmail\",\"beforeChanges.AccessType\",\"afterChanges.AccessType\",\"actorType\",\"message.en-US\",\"actorDisplayName\" as record_id,event_type,target_name, target_email, access_type_before, access_type_after, actor_type, message, actor_name nodrop",
    "app": "Citrix Cloud"
  },
  {
    "parser": "| parse regex \"\\\"(?i)userName\\\":\\\"(?<user_name>.*?)\\\"\" nodrop\n| parse \"\\\"userId\\\":\\\"*\\\"\" as user_id nodrop\n| parse \"\\\"eventName\\\":\\\"*\\\"\" as event_name\n| parse regex field=event_name \"^(?:Delete)(?<resource_type>[A-Z][A-Za-z]+)\"",
    "app": "Cloud Infrastructure Security for AWS"
  },
  {
    "parser": "| json \"requestID\",\"eventID\",\"userIdentity.sessionContext.sessionIssuer.userName\",\"userIdentity.accountId\",\"sourceIPAddress\",\"awsRegion\",\"eventName\" as request_id, event_id,user.name,cloud.account.id,client.ip,cloud.region,event.action",
    "app": "Cloud Infrastructure Security for AWS "
  },
  {
    "parser": "| json \"requestID\",\"eventID\",\"userIdentity.sessionContext.sessionIssuer.userName\",\"userIdentity.accountId\",\"sourceIPAddress\",\"awsRegion\",\"eventName\",\"eventType\" as request_id, event_id,user_name,acc_id,source_ip,region,event_name,event_type nodrop",
    "app": "Cloud Infrastructure Security for AWS 2024-03-13  - DEMO  V1.0.1"
  },
  {
    "parser": "| json \"ClientIP\" as  client_ip nodrop",
    "app": "Cloudflare"
  },
  {
    "parser": "| parse regex \"\\\"os_types_summary\\\": \\{\\\"count\\\": (?<num_of_os_types>\\d*),\"",
    "app": "CloudPassage Halo"
  },
  {
    "parser": "| json \"log\" as _rawlog nodrop\n| json \"name\" as event_name\n| json \"bucket\"",
    "app": "Couchbase"
  },
  {
    "parser": "| json \"log\" as _rawlog nodrop\n| json \"name\" as event_name\n| json \"bucket\"",
    "app": "Couchbase - OpenTelemetry"
  },
  {
    "parser": "| json field=_raw \"event.SeverityName\", \"event.Tactic\", \"event.Technique\" as severity, tactic, technique",
    "app": "CrowdStrike - Falcon Endpoint Protection"
  },
  {
    "parser": "| parse \"CEF:0\n| CrowdStrike\n| FalconHost\n| 1.0\n| DetectionSummaryEvent\n| *\n| *\n| \" as detect_type,sev",
    "app": "CrowdStrike - Falcon Platform"
  },
  {
    "parser": "| json \"metadata.eventType\", \"metadata.customerIDString\", \"metadata.eventCreationTime\" as event_type, customer_id, event_time",
    "app": "CrowdStrike - Falcon V2"
  },
  {
    "parser": "| json \"status\", \"platform_name\", \"os_version\", \"system_manufacturer\", \"provision_status\", \"device_id\" as status, platform_name, version, manufacturer, provision_status, device_id nodrop",
    "app": "CrowdStrike FDR Host Inventory"
  },
  {
    "parser": "| parse \"Event Type: *,\" as event_type",
    "app": "Cylance"
  },
  {
    "parser": "| json \"activityTypes\",\"repo.name\",\"sidecar.name\" nodrop",
    "app": "Cyral"
  },
  {
    "parser": "| parse regex \"\\\"(?<source>[^\\\"]+)\\\"\\:\\{\\\"dataPoints\\\"\\:(?<datapoints>\\d+)\\}\" multi",
    "app": "Data Volume"
  },
  {
    "parser": "| parse regex \"\\\"(?<collector>[^\\\"]+)\\\"\\:\\{\\\"dataPoints\\\"\\:(?<datapoints>\\d+)\\}\" multi",
    "app": "Data Volume (Legacy)"
  },
  {
    "parser": "| json \"memory_stats.stats.rss\" as rss nodrop",
    "app": "Docker"
  },
  {
    "parser": "| json field=_raw \"status\" as state\n| json field=_raw \"Type\" as type\n| json field=_raw \"Actor.Attributes.image\" as image\n| json field=_raw \"Actor.Attributes.name\" as name",
    "app": "Docker - OpenTelemetry"
  },
  {
    "parser": "| json field=_raw \"status\" as state\n| json field=_raw \"Type\" as type\n| json field=_raw \"Actor.Attributes.image\" as image\n| json field=_raw \"Actor.Attributes.name\" as name",
    "app": "Docker ULM"
  },
  {
    "parser": "| json \"object\",\"userId\",\"eventId\",\"action\",\"property\",\"source\",\"ipAddressLocation.latitude\",\"ipAddressLocation.longitude\",\"result\",\"ipAddressLocation.city\",\"ipAddressLocation.state\",\"ipAddressLocation.country\" as object,user_id,event_id,action,property,source,latitude,longitude,result,city,state,country nodrop",
    "app": "DocuSign"
  },
  {
    "parser": "| json \"$['actor']['.tag']\",\"$['actor']*['.tag']\",\"$['actor']*['account_id']\",\"$['actor']*['display_name']\",\"$['actor']*['email']\",\"$['actor']*['team_member_id']\",\"$['event_type']['.tag']\",\"$['event_type']['description']\",\"details.app_info.display_name\", \"origin.geo_location.ip_address\", \"origin.geo_location.country\",\"$['event_category']['.tag']\",\"involve_non_team_member\" as actor,actor_is_team_member,actor_account_id, actor_display_name, actor_email,actor_team_member_id, event_type, event_type_description, app_name,location,country, event_category,involve_non_team_member nodrop\n| json field=actor_email \"[0]\" as email nodrop\n| json field=actor_display_name \"[0]\" as name nodrop",
    "app": "Dropbox"
  },
  {
    "parser": "| extract field=event_details \"Anomaly\\sdetected:(?<activity_details>[\\S\\s]+?),\\sAffected\"",
    "app": "Druva"
  },
  {
    "parser": "| json \"id\",\"area\",\"category\",\"type\",\"syslogSeverity\",\"syslogFacility\" as id,area,category,type,syslog_severity,syslog_facility nodrop",
    "app": "Druva Cyber Resilience"
  },
  {
    "parser": "| json field=_raw \"eventtype\" as eventtype",
    "app": "Duo Security"
  },
  {
    "parser": "| json \"log\" as rawlog nodrop\n| parse regex \"\\[(?<date>[^\\]]+)\\]\\[(?<process_id>[^\\]]+)\\]\\[(?<module>[^\\]]+)\\]\\s+GC\\(.*\\)(?<Time_Name>.*):\\s+(?<pre_collect_set>\\d+\\.\\d+)ms\"",
    "app": "Elasticsearch"
  },
  {
    "parser": "| json \"log\" as rawlog nodrop\n| parse regex \"\\[(?<date>[^\\]]+)\\]\\[(?<process_id>[^\\]]+)\\]\\[(?<module>[^\\]]+)\\]\\s+GC\\(.*\\)(?<Time_Name>.*):\\s+(?<pre_collect_set>\\d+\\.\\d+)ms\"",
    "app": "Elasticsearch - OpenTelemetry"
  },
  {
    "parser": "| split log delim='\t' extract 10 as smb_file",
    "app": "Endace"
  },
  {
    "parser": "| json \"reason\" nodrop",
    "app": "Enterprise Audit - Cloud SIEM"
  },
  {
    "parser": "| json \"eventName\" as EventName nodrop",
    "app": "Enterprise Audit - Collector & Data Forwarding Management"
  },
  {
    "parser": "| json \"eventName\" as EventName nodrop",
    "app": "Enterprise Audit - Content Management"
  },
  {
    "parser": "| json \"eventName\" as EventName nodrop",
    "app": "Enterprise Audit - Security Management"
  },
  {
    "parser": "| json \"eventName\" as EventName nodrop",
    "app": "Enterprise Audit - User & Role Management"
  },
  {
    "parser": "| parse regex field=queryLower \"^(?<scope_section_raw>[^\\\n| ]+)\" nodrop\n| parse regex field=scope_section_raw \"(?:_index\n| _view)\\s*=\\s*(?<meta_index>[^\\s\\\n| \\)]+)\" multi nodrop",
    "app": "Enterprise Search Audit"
  },
  {
    "parser": "| json \"data.id\", \"data.attributes\" as id, data_attrib\n| json \"included.[0].attributes.name\" as account_name\n| json \"included.[1].attributes.code\" as region\n| json \"included.[2].attributes.risk_level\" as risk_level\n| json field=data_attrib \"resource\", \"status\", \"created_at\", \"started_at\", \"updated_at\", \"ended_at\"",
    "app": "Evident.io ESP"
  },
  {
    "parser": "| json \"system.tmmCpu\" as cpu\n| json \"system.tmmMemory\" as memory\n| json \"system.hostname\" as host",
    "app": "F5 - BIG-IP - LTM"
  },
  {
    "parser": "| json \"waf_executed\" as waf_executed nodrop",
    "app": "Fastly"
  },
  {
    "parser": "| parse regex \"\\\"(?<source>[^\\\"]+)\\\"\\:\\{\\\"dataPoints\\\"\\:(?<datapoints>\\d+)\\}\" multi",
    "app": "Flex"
  },
  {
    "parser": "| json \"alertId\",\"customerId\",\"source\",\"type\",\"data\" as alert_id, customer_id, source, type, data",
    "app": "G Suite"
  },
  {
    "parser": "| json  \"repository.name\" as  repo_name",
    "app": "GitHub"
  },
  {
    "parser": "| parse regex field=group \"(?<group>.+)\\/.+\"",
    "app": "Gitlab"
  },
  {
    "parser": "| parse field=threatname \"*.*\" as name, variant nodrop",
    "app": "Global Intelligence for Amazon GuardDuty"
  },
  {
    "parser": "| json auto maxdepth 1 nodrop\n| parse regex field=apache_log_message \"^(?<Client_Ip>\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})\"\n| parse regex field=apache_log_message \"(?<Method>[A-Za-z]+)\\s(?<URL>\\S+)\\sHTTP/[\\d\\.]+\\\"\\s(?<Status_Code>\\d+)\\s(?<Size>[\\d-]+)\\s\\\"(?<Referrer>.*?)\\\"\\s\\\"(?<User_Agent>.+?)\\\".*\"",
    "app": "Global Intelligence for Apache"
  },
  {
    "parser": "| json auto maxdepth 1 nodrop\n| parse regex field=tomcat_log_message \"(?<remote_ip>\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})\\s+(?<user>\\S+)\\s+(?<hostname>[\\S]+)\\s+\\[\" nodrop\n| parse regex field=tomcat_log_message \"(?<remote_ip>\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})\\s+(?<local_ip>\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})\\s+(?<user>\\S+)\\s+(?<hostname>[\\S]+)\\s+\\[\" nodrop\n| parse regex field=tomcat_log_message \"\\s+\\[(?<date>[^\\]]+)\\]\\s+\\\"(?<method>\\w+)\\s+(?<uri>\\S+)\\s+(?<protocol>\\S+)\\\"\\s+(?<status_code>\\d+)\\s+(?<size>[\\d-]+)\" nodrop\n| parse regex field=tomcat_log_message \"\\\"\\s+\\d+\\s+[\\d-]+\\s+(?<timetaken>[\\d-]+)\"",
    "app": "Global Intelligence for Apache Tomcat"
  },
  {
    "parser": "| json \"eventName\", \"errorCode\" nodrop",
    "app": "Global Intelligence for AWS CloudTrail"
  },
  {
    "parser": "| parse \"\\\"awsRegion\\\":\\\"*\\\"\" as awsRegion\n| parse \"\\\"eventSource\\\":\\\"*\\\"\" as eventSource\n| parse \"\\\"eventName\\\":\\\"*\\\"\" as eventName\n| parse \"\\\"eventType\\\":\\\"*\\\"\" as eventType\n| parse \"\\\"recipientAccountId\\\":\\\"*\\\"\" as accountId\n| parse field=eventSource \"*.amazonaws.com\" as resourceType\n| parse \"\\\"errorCode\\\":\\\"*\\\"\" as errorCode\n| parse \"\\\"userName\\\":\\\"*\\\"\" as userName",
    "app": "Global Intelligence for CloudTrail DevOps"
  },
  {
    "parser": "| parse regex \"\\\"logName\\\":\\\"(?<log_name>[^\\\"]+)\\\"\"\n| json \"message.data.resource.labels\" as labels\n| json field=labels \"module_id\", \"project_id\", \"version_id\", \"zone\" as service, project, version, zone",
    "app": "Google App Engine"
  },
  {
    "parser": "| parse regex \"\\\"logName\\\":\\\"(?<log_name>[^\\\"]+)\\\"\"\n| json \"message.data.resource.labels\", \"message.data.resource.labels.project_id\" as labels, project",
    "app": "Google BigQuery"
  },
  {
    "parser": "| parse regex \"\\\"logName\\\":\\\"(?<log_name>[^\\\"]+)\\\"\"\n| json \"message.data\" as data\n| json field=data \"resource.labels\", \"resource.labels.project_id\", \"protoPayload.authenticationInfo.principalEmail\" as labels, project, user",
    "app": "Google Cloud Audit"
  },
  {
    "parser": "| json \"message.data.resource.type\",\"message.data.logName\" as type,log_name\n| json \"message.data.resource.labels.project_id\",\"message.data.resource.labels.zone\",\"message.data.resource.labels.instance_id\" as project_id,zone,instance_id\n| json \"message.data.severity\" as severity\n| json \"message.data.jsonPayload.message\" as payload\n| json \"message.data.timestamp\" as timestamp",
    "app": "Google Cloud Compute Engine"
  },
  {
    "parser": "| parse regex \"\\\"logName\\\":\\\"(?<log_name>[^\\\"]+)\\\"\"\n| parse regex \"\\\"reference\\\":\\\"network:[^\\\"/]+/firewall:(?<rule>[^\\\"]+)\\\"\"\n| json \"message.data.resource.labels\", \"message.data.jsonPayload\" as labels, payload\n| json field=labels \"location\",\"project_id\",\"subnetwork_id\",\"subnetwork_name\" as zone,project,subnetwork_id,subnetwork_name nodrop\n| json field=payload \"disposition\", \"instance.vm_name\", \"vpc.vpc_name\", \"rule_details\" as disposition, vm_instance, network, rule_details\n| json field=rule_details \"action\", \"priority\", \"direction\"",
    "app": "Google Cloud Firewall"
  },
  {
    "parser": "| json \"message.data.logName\" as log_name\n| json \"message.data.resource.labels\" as labels\n| json field=labels \"function_name\", \"project_id\", \"region\" as function_name, project_id, region",
    "app": "Google Cloud Functions"
  },
  {
    "parser": "| json \"message.data.resource.type\" as type\n| parse regex \"\\\"logName\\\":\\\"(?<log_name>[^\\\"]+)\\\"\"\n| json \"message.data.resource.labels\" as labels\n| json field=labels \"project_id\" as project",
    "app": "Google Cloud IAM"
  },
  {
    "parser": "| parse regex \"\\\"logName\\\":\\\"(?<log_name>[^\\\"]+)\\\"\"\n| json \"message.data.resource.labels\" as labels\n| json field=labels \"project_id\", \"zone\", \"url_map_name\" as project, zone, load_balancer",
    "app": "Google Cloud Load Balancing"
  },
  {
    "parser": "| parse regex \"\\\"logName\\\":\\\"(?<log_name>[^\\\"]+)\\\"\"\n| json \"message.data.resource.labels\", \"message.data.textPayload\" as labels, text\n| json field=labels \"database_id\", \"project_id\", \"region\" as instance, project, region",
    "app": "Google Cloud SQL"
  },
  {
    "parser": "| parse regex \"\\\"logName\\\":\\\"(?<log_name>[^\\\"]+)\\\"\"\n| json \"message.data.resource.labels\" as labels\n| json field=labels \"project_id\", \"bucket_name\", \"location\" as project, bucket_name, location",
    "app": "Google Cloud Storage"
  },
  {
    "parser": "| json \"message.data.resource.type\" as type\n| parse regex \"\\\"logName\\\":\\\"(?<log_name>[^\\\"]+)\\\"\"\n| json \"message.data.jsonPayload.connection.src_ip\", \"message.data.jsonPayload.start_time\", \"message.data.jsonPayload.end_time\" as src_ip, start_time, end_time",
    "app": "Google Cloud VPC"
  },
  {
    "parser": "| json \"message.data.resource.type\" as type\n| parse regex \"\\\"logName\\\":\\\"(?<log_name>[^\\\"]+)\\\"\"\n| json \"message.data.protoPayload.resourceName\" as resourceName\n| parse regex field=resourcename \"projects/\\S+/zones/(?<zone>\\S+)/instances/(?<instance>\\S+)\"\n| json \"message.data.resource.labels.project_id\", \"message.data.protoPayload.methodName\", \"message.data.severity\" as project, method, severity",
    "app": "Google Compute Engine"
  },
  {
    "parser": "| json \"message.data.severity\" as severity",
    "app": "Google Kubernetes Engine (GKE) - Control Plane"
  },
  {
    "parser": "| json \"alertId\",\"customerId\",\"source\",\"type\",\"data\" as alert_id, customer_id, source, type, data",
    "app": "Google Workspace"
  },
  {
    "parser": "| parse field=metric haproxy_http_response_* as code\n|",
    "app": "HAProxy"
  },
  {
    "parser": "| parse field=status_code *  as code\n|",
    "app": "HAProxy - OpenTelemetry"
  },
  {
    "parser": "| json \"id\", \"created_at\", \"event.op\",\"table.name\",\"table.schema\",\"trigger.name\" as id, created_at, operation, tableName, tableSchema, triggerName nodrop",
    "app": "Hasura"
  },
  {
    "parser": "| parse \" dyno=* \" as dyno",
    "app": "Heroku"
  },
  {
    "parser": "| parse field=instance * as app_pool_instance\n|",
    "app": "IIS 10"
  },
  {
    "parser": "| json \"log\" as _rawlog nodrop\n| parse regex field=iis_log_message \"(?<server_ip>\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}) (?<method>\\S+?) (?<cs_uri_stem>\\S+?) (?<cs_uri_query>\\S+?) (?<s_port>\\S+?) (?<cs_username>\\S+?) (?<c_ip>\\S+?) (?<cs_User_Agent>\\S+?) (?<cs_referer>\\S+?) (?<sc_status>\\S+?) (?<sc_substatus>\\S+?) (?<sc_win32_status>\\S+?) (?<time_taken>\\S+?)$\"",
    "app": "IIS 10 - OpenTelemetry"
  },
  {
    "parser": "| parse \"Name = \\\"*\\\";\" as Name nodrop\n| parse \"ArrivalRate = \\\"*\\\";\" as ArrivalRate nodrop\n| parse \"CacheHitRate = \\\"*\\\";\" as CacheHitRate nodrop",
    "app": "IIS 10 (Legacy)"
  },
  {
    "parser": "| parse regex \"(?:80\n| 443) (?:\\w+\n| -+\n| \\\\+)+ (?<client_ip>\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}) \"",
    "app": "IIS 7"
  },
  {
    "parser": "| json \"id\", \"summary\", \"details\", \"reportTime\", \"status\", \"eventType\", \"priority\", \"alertSource.name\", \"assignedTo.username\", \"assignedTo.email\", \"responders[0].user.username\", \"responders[0].user.email\" as id, summary, detail, reportTime, status, eventType, priority, alertSource, assignedUserName, assignedEmail, responderUserName, responderEmail nodrop",
    "app": "iLert"
  },
  {
    "parser": "| parse \"cs10=[*] cs10Label\" as adr_rule\n| parse \"sourceServiceName=* \" as site_name",
    "app": "Imperva - Incapsula Web Application Firewall"
  },
  {
    "parser": "| json field=scanned_bytes_breakdown \"Infrequent\" as data_scanned_bytes",
    "app": "Infrequent Data Tier"
  },
  {
    "parser": "| json field=_raw \"log\" as msg\n| json field=_raw \"time\" as date_time",
    "app": "Istio"
  },
  {
    "parser": "| json \"name\", \"result\" as Name, Result",
    "app": "Jenkins"
  },
  {
    "parser": "| json \"top_severity\", \"issues\", \"watch_name\", \"policy_name\" as TopSeverity, Issues, WatchName, PolicyName nodrop\n| parse regex field=Issues \"(?<Issue>\\{.*?(?=,\\{\\\"severity\\\"\n| \\]$))\" multi\n| json field=Issue \"impacted_artifacts\" as Artifacts nodrop\n| parse regex field=Artifacts \"(?<Artifact>\\{.*?(?=,\\{\\\"sha1\\\"\n| \\]$))\" multi\n| json field=Artifact \"display_name\" as ArtifactDisplayName nodrop\n| parse field=ArtifactDisplayName \"*\" as Field1\n| parse regex field=field1 \"(?<field2>.*?):(?<field1>[^:]+$)\" nodrop\n| parse regex field=field2 \"(?<field3>.*?):(?<field2>[^:]+$)\" nodrop\n| parse \"*\n| *\n| *\n| *\n| *\n| *\n| *\n| *\n| *\n| *\" as datetime, response_time, type, IP, user, method, Path, protocol, status_code, size nodrop",
    "app": "JFrog Xray"
  },
  {
    "parser": "| json field=_raw \"webhookEvent\" as event_name",
    "app": "Jira"
  },
  {
    "parser": "| json field=_raw \"webhookEvent\" as event_name",
    "app": "Jira - OpenTelemetry"
  },
  {
    "parser": "| json field=_raw \"webhookEvent\" as event_name",
    "app": "Jira Cloud"
  },
  {
    "parser": "| parse field=jolokia_agent_url * as Server\n|",
    "app": "JMX"
  },
  {
    "parser": "| parse field=jolokia_agent_url * as Server",
    "app": "Kafka"
  },
  {
    "parser": "| json auto maxdepth 1 nodrop\n| parse field=kafka_log_message \"[*] * *\" as date_time,severity,msg",
    "app": "Kafka - OpenTelemetry"
  },
  {
    "parser": "| json  \"log\" as msg",
    "app": "Kubernetes"
  },
  {
    "parser": "| json field=_raw \"log\" as log\n| parse field=log \"Deleted job *\" as job_name",
    "app": "Kubernetes - Control Plane"
  },
  {
    "parser": "| json  \"log\"",
    "app": "Kubernetes - Control Plane >= 1.16"
  },
  {
    "parser": "| json  \"log\" as msg",
    "app": "Kubernetes_Old"
  },
  {
    "parser": "| parse regex field=series_of_ones \"(?<one_per_time_slice>[0-9])\" multi",
    "app": "LambdaTest"
  },
  {
    "parser": "| parse regex \"\\d+\\s+\\d+:\\d+:\\d+\\s(?<dest_hostname>\\S+)\\s(?<process_name>\\w*)(?:\\[\\d+\\]\n|",
    "app": "Linux"
  },
  {
    "parser": "| parse regex \"\\S*\\s+\\d+\\s+\\d+:\\d+:\\d+\\s+(?<dest_host>\\S*)\\s+\" nodrop",
    "app": "Linux - Cloud Security Monitoring and Analytics"
  },
  {
    "parser": "| parse regex \"\\S*\\s+\\d+\\s+\\d+:\\d+:\\d+\\s+(?<dest_host>\\S*)\\s+\" nodrop",
    "app": "Linux - Cloud Security Monitoring and Analytics - OpenTelemetry"
  },
  {
    "parser": "| parse regex \"\\d+\\s+\\d+:\\d+:\\d+\\s(?<dest_hostname>\\S*)\\s(?<process_name>\\w*)(?:\\[\\d+\\]\n| ):\\s+\"",
    "app": "Linux - OpenTelemetry"
  },
  {
    "parser": "| parse regex \"session_?(?:id)?[\\s:-=]?(?<session_id>[^\\s]+)\"",
    "app": "Log Analysis QuickStart"
  },
  {
    "parser": "| json \"event-data.recipient\" as recipient nodrop",
    "app": "Mailgun"
  },
  {
    "parser": "| parse field=metric mysql_com_* as com\n|",
    "app": "MariaDB"
  },
  {
    "parser": "| json \"log\" nodrop\n| if (_raw matches \"{*\", log, _raw) as mesg",
    "app": "MariaDB - OpenTelemetry"
  },
  {
    "parser": "| parse field=metric memcached_cas_* as name\n| sum by db_cluster,host,name\n|",
    "app": "Memcached"
  },
  {
    "parser": "| json \"log\" as _rawlog nodrop\n| parse regex field=memcached_log_message \">(?<pid>\\d+) (?<msg>.+)\"",
    "app": "Memcached - OpenTelemetry"
  },
  {
    "parser": "| json \"Organization\", \"MessageId\", \"Received\",\"SenderAddress\", \"RecipientAddress\", \"Subject\", \"Status\", \"ToIP\", \"FromIP\", \"Size\", \"MessageTraceId\", \"StartDate\", \"EndDate\", \"Index\" as organization, message_id, received, sender_address, recipient_address, subject, status, toIP, fromIP, size, message_traceId, start_date, end_Date, index nodrop",
    "app": "Microsoft Exchange Trace Logs"
  },
  {
    "parser": "| json \"id\",\"activityDisplayName\",\"category\",\"loggedByService\",\"operationType\",\"result\",\"resultReason\",\"targetResources[*].type\",\"initiatedBy.user\",\"initiatedBy.app\" as id,activity,category,logged_by_service,operation_type,operation_result,result_reason,target_resource_type,is_user_initiator,is_app_initiator nodrop",
    "app": "Microsoft Graph Azure AD Reporting"
  },
  {
    "parser": "| json \"id\", \"userPrincipalName\", \"isDeleted\", \"isProcessing\", \"riskLevel\", \"riskState\", \"riskDetail\", \"riskLastUpdatedDateTime\" as user_id, user, is_deleted, is_processing, risk_level, risk_state, risk_action, risk_last_updated_date_time nodrop",
    "app": "Microsoft Graph Identity Protection"
  },
  {
    "parser": "| extract field=comments \"(?<comment_info>\\{.*?\\})\" multi\n| json field=comment_info \"createdByDisplayName\" as analyst",
    "app": "Microsoft Graph Security"
  },
  {
    "parser": "| json \"Workload\"",
    "app": "Microsoft Office 365"
  },
  {
    "parser": "| json \"Workload\", \"Operation\", \"UserId\" as workload, operation, email",
    "app": "Microsoft Teams"
  },
  {
    "parser": "| json \"id\", \"type\", \"context.team.name\", \"context.organization.name\", \"context.ip\", \"createdAt\", \"event\", \"createdBy.name\", \"createdBy.email\"  as id, type, team_name, organization_name, ip, createdAt, event, user_name, user_email nodrop",
    "app": "Miro"
  },
  {
    "parser": "| json \"log\" as _rawlog nodrop\n| json field=_raw \"t.$date\" as timestamp\n| json field=_raw \"s\" as severity\n| json field=_raw \"c\" as component\n| json field=_raw \"ctx\" as context\n| json field=_raw \"msg\" as msg",
    "app": "MongoDB"
  },
  {
    "parser": "| json \"log\" as _rawlog nodrop\n| json field=_raw \"t.$date\" as timestamp\n| json field=_raw \"s\" as severity\n| json field=_raw \"c\" as mongodb_component\n| json field=_raw \"ctx\" as context\n| json field=_raw \"msg\" as msg",
    "app": "MongoDB - OpenTelemetry"
  },
  {
    "parser": "| json \"t.$date\",\"s\",\"c\",\"ctx\" as timestamp,severity,component,context\n| json \"msg\",\"project_id\",\"hostname\",\"cluster_name\"",
    "app": "MongoDB Atlas 6"
  },
  {
    "parser": "| json \"log\" nodrop\n| if (_raw matches \"{*\", log, _raw) as mesg",
    "app": "MySQL"
  },
  {
    "parser": "| json \"log\" nodrop\n| if (_raw matches \"{*\", log, _raw) as mesg",
    "app": "MySQL - OpenTelemetry"
  },
  {
    "parser": "| json \"Test Name\", \"Project\", \"Scenario\", \"Status\", \"Quality Status\", \"Workspace Name\" as testName, project, scenario, status, qualityStatus, workspace nodrop",
    "app": "NeoLoad"
  },
  {
    "parser": "| json \"id\", \"state\", \"name\", \"created_at\", \"updated_at\", \"user_id\", \"build_id\", \"error_message\", \"branch\", \"locked\", \"title\", \"commit_message\", \"context\", \"deploy_time\", \"manual_deploy\", \"public_repo\", \"committer\", \"published_at\" as id, state, name, createdAt, updatedAt, userId, buildId, errorMessage, branch, locked, title, commitMessage, context, deployTime, manualDeploy, publicRepo, committer, publishedAt nodrop",
    "app": "Netlify"
  },
  {
    "parser": "| json \"_id\", \"alert\", \"alert_type\", \"user\" nodrop",
    "app": "Netskope"
  },
  {
    "parser": "| json auto maxdepth 1 nodrop\n| parse regex field=nginx_log_message \"\\s\\[(?<Log_Level>\\S+)\\]\\s\\d+#\\d+:\\s(?:\\*\\d+\\s\n| )(?<Message>[A-Za-z][^,]+)(?:,\n| $)\"\n| parse field=nginx_log_message \"client: *, server: *, request: \\\"* * HTTP/1.1\\\", host: \\\"*\\\"\" as Client_Ip, Server, Method, URL, Host nodrop",
    "app": "Nginx"
  },
  {
    "parser": "| json auto maxdepth 1 nodrop\n| parse regex field=nginx_log_message \"(?<Client_Ip>(?:[0-9A-Fa-f]{1,4}:){7}[0-9A-Fa-f]{1,4}\n| \\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})\"\n| parse regex field=nginx_log_message \"(?<Method>[A-Z]+)\\s+(?<URL>\\S+)\\sHTTP/[\\d\\.]+\\\"\\s+(?<Status_Code>\\d+)\\s+(?<Size>[\\d-]+)\\s+\\\"(?<Referrer>.*?)\\\"\\s+\\\"(?<User_Agent>.+?)\\\".*\"",
    "app": "Nginx - OpenTelemetry"
  },
  {
    "parser": "| json auto maxdepth 1 nodrop\n| parse regex field=nginx_log_message \"(?<Client_Ip>\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})\"\n| parse regex field=nginx_log_message \"(?<Method>[A-Z]+)\\s(?<URL>\\S+)\\sHTTP/[\\d\\.]+\\\"\\s(?<Status_Code>\\d+)\\s(?<Size>[\\d-]+)\\s\\\"(?<Referrer>.*?)\\\"\\s\\\"(?<User_Agent>.+?)\\\".*\"",
    "app": "Nginx (Legacy)"
  },
  {
    "parser": "| json auto maxdepth 1 nodrop\n| parse regex field=nginx_log_message \"(?<Client_Ip>\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})\"\n| parse regex field=nginx_log_message \"(?<Method>[A-Z]+)\\s(?<URL>\\S+)\\sHTTP/[\\d\\.]+\\\"\\s(?<Status_Code>\\d+)\\s(?<Size>[\\d-]+)\\s\\\"(?<Referrer>.*?)\\\"\\s\\\"(?<User_Agent>.+?)\\\".*\"",
    "app": "Nginx Ingress"
  },
  {
    "parser": "| json auto maxdepth 1 nodrop\n| parse regex field=nginx_log_message \"(?<Client_Ip>\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})\"\n| parse regex field=nginx_log_message \"(?<Method>[A-Z]+)\\s(?<URL>\\S+)\\sHTTP/[\\d\\.]+\\\"\\s(?<Status_Code>\\d+)\\s(?<Size>[\\d-]+)\\s\\\"(?<Referrer>.*?)\\\"\\s\\\"(?<User_Agent>.+?)\\\".*\"",
    "app": "Nginx Plus"
  },
  {
    "parser": "| json auto maxdepth 1 nodrop\n| parse regex field=nginx_log_message \"(?<Client_Ip>\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})\"\n| parse regex field=nginx_log_message \"(?<Method>[A-Z]+)\\s(?<URL>\\S+)\\sHTTP/[\\d\\.]+\\\"\\s(?<Status_Code>\\d+)\\s(?<Size>[\\d-]+)\\s\\\"(?<Referrer>.*?)\\\"\\s\\\"(?<User_Agent>.+?)\\\".*\"",
    "app": "Nginx Plus Ingress"
  },
  {
    "parser": "| json \"role\" as role",
    "app": "Observable Networks"
  },
  {
    "parser": "| json field=_raw \"eventType\" as event_type\n| json field=_raw \"severity\"  as severity\n| json field=_raw \"actor.displayName\" as okta_user_name\n| json field=_raw \"actor.alternateId\" as okta_user_id",
    "app": "Okta"
  },
  {
    "parser": "| json \"event.risk_score\", \"event.risk_reasons\" as risk_score, risk_reasons nodrop",
    "app": "OneLogin"
  },
  {
    "parser": "| json  \"action\"",
    "app": "Opsgenie"
  },
  {
    "parser": "| json \"log\" as _rawlog nodrop",
    "app": "Oracle - OpenTelemetry"
  },
  {
    "parser": "| json \"alert_id\",\"name\",\"severity\",\"source\",\"host_ip\",\"alert_type\",\"action_pretty\",\"agent_os_type\",\"category\",\"detection_timestamp\",\"is_whitelisted\",\"resolution_status\" as alert_id,name,severity,source,host_ip,alert_type,action_pretty,agent_os_type,category,detection_timestamp,is_whitelisted,resolution_status nodrop",
    "app": "Palo Alto Cortex XDR"
  },
  {
    "parser": "| csv _raw extract 1 as f1, 2 as Receive_Time, 3 as serialNum, 4 as type, 5 as subtype, 6 as f2, 7 as LogGenerationTime, 8 as src_ip, 9 as dest_ip, 10 as NAT_src_ip, 11 as NAT_dest_ip, 12 as ruleName, 13 as src_user, 14 as dest_user, 15 as app, 16 as vsys, 17 as src_zone, 18 as dest_zone, 19 as inbound_interface, 20 as outbound_interface, 21 as LogAction, 22 as f3, 23 as SessonID, 24 as RepeatCount, 25 as src_port, 26 as dest_port, 27 as NAT_src_port, 28 as NAT_dest_port, 29 as flags, 30 as protocol, 31 as action,32 as bytes, 33 as bytes_sent, 34 as bytes_recv, 35 as Packets, 36 as StartTime, 37 as ElapsedTime, 38 as Category, 39 as f4, 40 as seqNum, 41 as ActionFlags, 42 as src_Country, 43 as dest_country, 44 as pkts_sent, 45 as pkts_received, 46 as session_end_reason, 47 as Device_Group_Hierarchy , 48 as vsys_Name, 49 as DeviceName, 50 as action_source, 51 as Source_VM_UUID, 52 as Destination_VM_UUID, 53 as Tunnel_ID_IMSI, 54 as Monitor_Tag_IMEI, 55 as Parent_Session_ID, 56 as parent_start_time, 57 as Tunnel, 58 as SCTP_Association_ID, 59 as SCTP_Chunks, 60 as SCTP_Chunks_Sent, 61 as SCTP_Chunks_Received",
    "app": "Palo Alto Firewall - Cloud Security Monitoring and Analytics"
  },
  {
    "parser": "| csv _raw extract 1 as f1, 2 as Receive_Time, 3 as serialNum, 4 as type, 5 as subtype, 6 as f2, 7 as LogGenerationTime, 8 as src_ip, 9 as dest_ip, 10 as NAT_src_ip, 11 as NAT_dest_ip, 12 as ruleName, 13 as src_user, 14 as dest_user, 15 as app, 16 as vsys, 17 as src_zone, 18 as dest_zone, 19 as inbound_interface, 20 as outbound_interface, 21 as LogAction, 22 as f3, 23 as SessonID, 24 as RepeatCount, 25 as src_port, 26 as dest_port, 27 as NAT_src_port, 28 as NAT_dest_port, 29 as flags, 30 as protocol, 31 as action, 32 as bytes, 33 as bytes_sent, 34 as bytes_recv, 35 as Packets, 36 as StartTime, 37 as ElapsedTime, 38 as Category, 39 as f4, 40 as seqNum, 41 as ActionFlags, 42 as src_Country, 43 as dest_country, 44 as f5, 45 as pkts_sent, 46 as pkts_received, 47 as session_end_reason, 48 as Device_Group_Hierarchy_l1, 49 as Device_Group_Hierarchy_l2, 50 as Device_Group_Hierarchy_l3, 51 as Device_Group_Hierarchy_l4, 52 as vsys_Name, 53 as DeviceName, 54 as action_source, 55 as Source_VM_UUID, 56 as Destination_VM_UUID, 57 as Tunnel_ID_IMSI, 58 as Monitor_Tag_IMEI, 59 as Parent_Session_ID, 60 as parent_start_time, 61 as Tunnel, 62 as SCTP_Association_ID, 63 as SCTP_Chunks, 64 as SCTP_Chunks_Sent, 65 as SCTP_Chunks_Received, 66 as UUIDforrule, 67 as HTTP2Connection, 68 as AppFlapCount ,69 as PolicyID ,70 as LinkSwitches ,71 as SDWANCluster ,72 as SDWANDeviceType ,73 as SDWANClusterType ,74 as SDWANSite ,75 as DynamicUserGroupName ,76 as XFFAddress ,77 as SourceDeviceCategory ,78 as SourceDeviceProfile ,79 as SourceDeviceModel ,80 as SourceDeviceVendor ,81 as SourceDeviceOSFamily ,82 as SourceDeviceOSVersion ,83 as SourceHostname ,84 as SourceMACAddress ,85 as DestinationDeviceCategory ,86 as DestinationDeviceProfile ,87 as DestinationDeviceModel ,88 as DestinationDeviceVendor ,89 as DestinationDeviceOSFamily ,90 as DestinationDeviceOSVersion ,91 as DestinationHostname ,92 as DestinationMACAddress ,93 as ContainerID ,94 as PODNamespace ,95 as PODName ,96 as SourceExternalDynamicList ,97 as DestinationExternalDynamicList ,98 as HostID ,99 as UserDeviceSerialNumber ,100 as SourceDynamicAddressGroup ,101 as DestinationDynamicAddressGroup ,102 as SessionOwner ,103 as HighResolutionTimestamp",
    "app": "Palo Alto Firewall 10 - Cloud Security Monitoring and Analytics"
  },
  {
    "parser": "| csv _raw extract 1 as f1, 2 as Receive_Time, 3 as serialNum, 4 as type, 5 as subtype, 6 as f2, 7 as LogGenerationTime, 8 as src_ip, 9 as dest_ip, 10 as NAT_src_ip, 11 as NAT_dest_ip, 12 as ruleName, 13 as src_user, 14 as dest_user, 15 as app, 16 as vsys, 17 as src_zone, 18 as dest_zone, 19 as inbound_interface, 20 as outbound_interface, 21 as LogAction, 22 as f3, 23 as SessonID, 24 as RepeatCount, 25 as src_port, 26 as dest_port, 27 as NAT_src_port, 28 as NAT_dest_port, 29 as flags, 30 as protocol, 31 as action, 32 as bytes, 33 as bytes_sent, 34 as bytes_recv, 35 as Packets, 36 as StartTime, 37 as ElapsedTime, 38 as Category, 39 as f4, 40 as seqNum, 41 as ActionFlags, 42 as src_Country, 43 as dest_country, 44 as f5, 45 as pkts_sent, 46 as pkts_received, 47 as session_end_reason, 48 as Device_Group_Hierarchy_l1, 49 as Device_Group_Hierarchy_l2, 50 as Device_Group_Hierarchy_l3, 51 as Device_Group_Hierarchy_l4, 52 as vsys_Name, 53 as DeviceName, 54 as action_source, 55 as Source_VM_UUID, 56 as Destination_VM_UUID, 57 as Tunnel_ID_IMSI, 58 as Monitor_Tag_IMEI, 59 as Parent_Session_ID, 60 as parent_start_time, 61 as Tunnel, 62 as SCTP_Association_ID, 63 as SCTP_Chunks, 64 as SCTP_Chunks_Sent, 65 as SCTP_Chunks_Received, 66 as UUIDforrule, 67 as HTTP2Connection",
    "app": "Palo Alto Firewall 9 - Cloud Security Monitoring and Analytics"
  },
  {
    "parser": "| parse \"*,*,*,*,*,*,*,*,*,*,*,*,*,*,*,*,*,*,*,*,*,*,*,*,*,*,*,*,*,*,*,*,*,*,*,*,*,*,*,*,*,*\" as f1,recvTime,serialNum,type,subtype,f2,genTime,src_ip,dest_ip,natsrc_ip,natdest_ip,ruleName,src_user,dest_user,app,vsys,src_zone,dest_zone,ingress_if,egress_if,logProfile,f3,sessionID,repeatCnt,src_port,dest_port,natsrc_port,natdest_port,flags,protocol,action,misc,threatID,cat,severity,direction,seqNum,action_flags,src_loc,dest_loc,f4,content_type\n| join( *\n| count as ipAPPCnt by src_ip,dest_ip,src_port,dest_port, threatid ) as threat,( *\n| count as evtCnt by src_ip\n| top 10 src_ip by evtCnt) as src_ip on threat.src_ip = src_ip.src_ip timewindow 12h\n| count_distinct(threat_dest_ip) as DistinctTargets by threat_src_ip,threat_dest_port, threat_threatid\n|",
    "app": "Palo Alto Networks 6"
  },
  {
    "parser": "| csv _raw extract 1 as f1, 2 as Receive_Time, 3 as serialNum, 4 as type, 5 as subtype, 6 as f2, 7 as LogGenerationTime, 8 as src_ip, 9 as src_user, 10 as vsys, 11 as Category, 12 as Severity, 13 as Device_Group_Hierarchy, 14 as vsys_name, 15 as DeviceName, 16 as vSysID, 17 as Object_Name, 18 as Object_ID, 19 as Evidence",
    "app": "Palo Alto Networks 8"
  },
  {
    "parser": "| csv _raw extract 1 as f1, 2 as Receive_Time, 3 as serialNum, 4 as type, 5 as subtype, 6 as f2, 7 as LogGenerationTime, 8 as vsys, 9 as eventID, 10 as Object, 11 as f3, 12 as f4, 13 as Module, 14 as severity, 15 as description, 16 as seqNum, 17 as action_flags, 18 as Device_Group_Hierarchy_l1, 19 as Device_Group_Hierarchy_l2, 20 as Device_Group_Hierarchy_l3, 21 as Device_Group_Hierarchy_l4, 22 as vsys_name, 23 as DeviceName",
    "app": "Palo Alto Networks 9"
  },
  {
    "parser": "| json \"logStream\", \"logGroup\", \"message\" as logStream, logGroup, msg\n| parse field=msg \"* * * * * * * * * * * * * *\" as version, account_id, interface_id, src_ip, dest_ip, src_port, dest_port, Protocol, packets, bytes, start, end, action, log_status",
    "app": "PCI Compliance For Amazon VPC Flow"
  },
  {
    "parser": "| parse \"\\\"eventName\\\":\\\"*\\\"\" as event_name nodrop",
    "app": "PCI Compliance For AWS CloudTrail"
  },
  {
    "parser": "| parse regex \"\\S*\\s+\\d+\\s+\\d+:\\d+:\\d+\\s+(?<dest_host>\\S*)\\s+\" nodrop",
    "app": "PCI Compliance For Linux"
  },
  {
    "parser": "| parse regex \"\\S*\\s+\\d+\\s+\\d+:\\d+:\\d+\\s+(?<dest_host>\\S*)\\s+\" nodrop",
    "app": "PCI Compliance for Linux - OpenTelemetry"
  },
  {
    "parser": "| csv _raw extract 1 as f1, 2 as Receive_Time, 3 as serialNum, 4 as type, 5 as subtype, 6 as f2, 7 as LogGenerationTime, 8 as src_ip, 9 as dest_ip, 10 as NAT_src_ip, 11 as NAT_dest_ip, 12 as ruleName, 13 as src_user, 14 as dest_user, 15 as app, 16 as vsys, 17 as src_zone, 18 as dest_zone, 19 as inbound_interface, 20 as outbound_interface, 21 as LogAction, 22 as f3, 23 as SessonID, 24 as RepeatCount, 25 as src_port, 26 as dest_port, 27 as NAT_src_port, 28 as NAT_dest_port, 29 as flags, 30 as protocol, 31 as action,32 as bytes, 33 as bytes_sent, 34 as bytes_recv, 35 as Packets, 36 as StartTime, 37 as ElapsedTime, 38 as Category, 39 as f4, 40 as seqNum, 41 as ActionFlags, 42 as src_Country, 43 as dest_country, 44 as pkts_sent, 45 as pkts_received, 46 as session_end_reason, 47 as Device_Group_Hierarchy , 48 as vsys_Name, 49 as DeviceName, 50 as action_source, 51 as Source_VM_UUID, 52 as Destination_VM_UUID, 53 as Tunnel_ID_IMSI, 54 as Monitor_Tag_IMEI, 55 as Parent_Session_ID, 56 as parent_start_time, 57 as Tunnel, 58 as SCTP_Association_ID, 59 as SCTP_Chunks, 60 as SCTP_Chunks_Sent, 61 as SCTP_Chunks_Received",
    "app": "PCI Compliance For Palo Alto Networks"
  },
  {
    "parser": "| csv _raw extract 1 as f1, 2 as Receive_Time, 3 as serialNum, 4 as type, 5 as subtype, 6 as f2, 7 as LogGenerationTime, 8 as src_ip, 9 as dest_ip, 10 as NAT_src_ip, 11 as NAT_dest_ip, 12 as ruleName, 13 as src_user, 14 as dest_user, 15 as app, 16 as vsys, 17 as src_zone, 18 as dest_zone, 19 as inbound_interface, 20 as outbound_interface, 21 as LogAction, 22 as f3, 23 as SessonID, 24 as RepeatCount, 25 as src_port, 26 as dest_port, 27 as NAT_src_port, 28 as NAT_dest_port, 29 as flags, 30 as protocol, 31 as action, 32 as bytes, 33 as bytes_sent, 34 as bytes_recv, 35 as Packets, 36 as StartTime, 37 as ElapsedTime, 38 as Category, 39 as f4, 40 as seqNum, 41 as ActionFlags, 42 as src_Country, 43 as dest_country, 44 as f5, 45 as pkts_sent, 46 as pkts_received, 47 as session_end_reason, 48 as Device_Group_Hierarchy_l1, 49 as Device_Group_Hierarchy_l2, 50 as Device_Group_Hierarchy_l3, 51 as Device_Group_Hierarchy_l4, 52 as vsys_Name, 53 as DeviceName, 54 as action_source, 55 as Source_VM_UUID, 56 as Destination_VM_UUID, 57 as Tunnel_ID_IMSI, 58 as Monitor_Tag_IMEI, 59 as Parent_Session_ID, 60 as parent_start_time, 61 as Tunnel, 62 as SCTP_Association_ID, 63 as SCTP_Chunks, 64 as SCTP_Chunks_Sent, 65 as SCTP_Chunks_Received, 66 as UUIDforrule, 67 as HTTP2Connection, 68 as AppFlapCount ,69 as PolicyID ,70 as LinkSwitches ,71 as SDWANCluster ,72 as SDWANDeviceType ,73 as SDWANClusterType ,74 as SDWANSite ,75 as DynamicUserGroupName ,76 as XFFAddress ,77 as SourceDeviceCategory ,78 as SourceDeviceProfile ,79 as SourceDeviceModel ,80 as SourceDeviceVendor ,81 as SourceDeviceOSFamily ,82 as SourceDeviceOSVersion ,83 as SourceHostname ,84 as SourceMACAddress ,85 as DestinationDeviceCategory ,86 as DestinationDeviceProfile ,87 as DestinationDeviceModel ,88 as DestinationDeviceVendor ,89 as DestinationDeviceOSFamily ,90 as DestinationDeviceOSVersion ,91 as DestinationHostname ,92 as DestinationMACAddress ,93 as ContainerID ,94 as PODNamespace ,95 as PODName ,96 as SourceExternalDynamicList ,97 as DestinationExternalDynamicList ,98 as HostID ,99 as UserDeviceSerialNumber ,100 as SourceDynamicAddressGroup ,101 as DestinationDynamicAddressGroup ,102 as SessionOwner ,103 as HighResolutionTimestamp ,104 as ASliceServiceType ,105 as ASliceDifferentiator",
    "app": "PCI Compliance For Palo Alto Networks 10"
  },
  {
    "parser": "| csv _raw extract 1 as f1, 2 as Receive_Time, 3 as serialNum, 4 as type, 5 as subtype, 6 as f2, 7 as LogGenerationTime, 8 as src_ip, 9 as dest_ip, 10 as NAT_src_ip, 11 as NAT_dest_ip, 12 as ruleName, 13 as src_user, 14 as dest_user, 15 as app, 16 as vsys, 17 as src_zone, 18 as dest_zone, 19 as inbound_interface, 20 as outbound_interface, 21 as LogAction, 22 as f3, 23 as SessonID, 24 as RepeatCount, 25 as src_port, 26 as dest_port, 27 as NAT_src_port, 28 as NAT_dest_port, 29 as flags, 30 as protocol, 31 as action,32 as bytes, 33 as bytes_sent, 34 as bytes_recv, 35 as Packets, 36 as StartTime, 37 as ElapsedTime, 38 as Category, 39 as f4, 40 as seqNum, 41 as ActionFlags, 42 as src_Country, 43 as dest_country, 44 as pkts_sent, 45 as pkts_received, 46 as session_end_reason, 47 as Device_Group_Hierarchy , 48 as vsys_Name, 49 as DeviceName, 50 as action_source, 51 as Source_VM_UUID, 52 as Destination_VM_UUID, 53 as Tunnel_ID_IMSI, 54 as Monitor_Tag_IMEI, 55 as Parent_Session_ID, 56 as parent_start_time, 57 as Tunnel, 58 as SCTP_Association_ID, 59 as SCTP_Chunks, 60 as SCTP_Chunks_Sent, 61 as SCTP_Chunks_Received",
    "app": "PCI Compliance For Palo Alto Networks 9"
  },
  {
    "parser": "| parse \"EventCode = *;\" as eventCode nodrop\n| parse \"Computer = \\\"*\\\";\" as comp_name nodrop\n| parse \"ComputerName = \\\"*\\\";\" as comp_name nodrop\n| parse regex \"Message = \\\"(?<msg_summary>[^\\r\\.]+?)(?:\\r\n| \\.\n| \\\";)\" nodrop",
    "app": "PCI Compliance For Windows"
  },
  {
    "parser": "| json \"EventID\", \"Computer\", \"Message\", \"EventData.SubjectUserName\", \"EventData.SubjectDomainName\" as event_id, host, msg_summary, src_user, src_domain nodrop",
    "app": "PCI Compliance For Windows JSON"
  },
  {
    "parser": "| json \"event_id.id\", \"computer\", \"message\" as event_id, host, msg_summary nodrop",
    "app": "PCI Compliance For Windows JSON - OpenTelemetry"
  },
  {
    "parser": "| parse \"connection received: host=* port=*\" as ip,port",
    "app": "PostgreSQL - OpenTelemetry"
  },
  {
    "parser": "| json \"model\", \"action\" as model, action",
    "app": "Postman"
  },
  {
    "parser": "| parse regex \"(?<email>[a-zA-Z0-9_\\.-]+@[\\da-zA-Z\\.-]+\\.[a-zA-Z\\.]{2,6})\"",
    "app": "Privacy Insights & GDPR"
  },
  {
    "parser": "| json \"guid\",\"filter.modules.dmarc\",\"filter.routeDirection\",\"msg.header.from\",\"msg.header.to\",\"filter.disposition\",\"connection.ip\",\"ts\",\"msg.header.subject\",\"msg.header.message-id\",\"filter.quarantine.folder\",\"filter.isMsgEncrypted\" as guid,action_dmarc,route_direction,sender_email,receiver_email,disposition,ip,time_stamp,subject,message_id,quarantine_folder,is_encrypted nodrop\n| json \"filter.actions[?(@.isFinal == true)].action\" as final_action\n| json \"filter.actions[?(@.isFinal == true)].rule\" as final_rule\n| json \"filter.actions[?(@.isFinal == true)].module\" as final_module",
    "app": "Proofpoint On Demand"
  },
  {
    "parser": "| json \"id\",\"type\",\"threatUrl\",\"classification\",\"clickIP\",\"senderIP\",\"sender\",\"recipient\",\"threatStatus\" as id,type,threat_url,category,click_ip,sender_ip,sender,recipient,threat_status nodrop",
    "app": "Proofpoint TAP"
  },
  {
    "parser": "| parse \"\\\"host\\\":\\\"*\\\"\" as node",
    "app": "Puppet"
  },
  {
    "parser": "| parse \"\\\"host\\\":\\\"*\\\"\" as node",
    "app": "Puppet - OpenTelemetry"
  },
  {
    "parser": "| json \"IP\", \"Hostname\", \"Detection.Qid\" as ip, hostname, Qid nodrop\n| json \"Detection\" as vulnerability nodrop\n| json auto field=vulnerability nodrop",
    "app": "Qualys VMDR"
  },
  {
    "parser": "| parse field=node *@* as user,host\n|",
    "app": "RabbitMQ"
  },
  {
    "parser": "| json \"log\" as _rawlog nodrop\n| parse \"* * [*]\" as date,time,severity\n|",
    "app": "RabbitMQ - OpenTelemetry"
  },
  {
    "parser": "| extract field=asset_vulnerability_last_found \"(?<date>.*)T(?<time>\\d*:\\d*:\\d*)\"",
    "app": "Rapid7"
  },
  {
    "parser": "| json \"log\" nodrop",
    "app": "Redis - OpenTelemetry"
  },
  {
    "parser": "| json field=_raw \"created\", \"type\", \"technicalName\", \"status\",\"operation\",\"actor.name\", \"action\", \"name\", \"target.name\", \"attributes.sourceName\" as created, event_type, technical_name_in_search, event_status, operation, user_name, action, event_desc, target_name, source_name\n| json \"org\" as org",
    "app": "SailPoint"
  },
  {
    "parser": "| json \"API_TYPE\"",
    "app": "Salesforce"
  },
  {
    "parser": "| json field=_raw \"id\", \"status\", \"data_type\" as job_id, status, data_type",
    "app": "Sauce Labs"
  },
  {
    "parser": "| json \"id\",\"computerName\",\"accountName\",\"groupName\",\"siteName\",\"activeThreats\",\"networkInterfaces[0].gatewayIp\",\"networkInterfaces[0].gatewayMacAddress\", \"osType\", \"machineType\", \"installerType\"  as agent_id, computer_name, account_name, group_name, site_name, active, ip_address, mac_address, os_type, machine_type, installer_type  nodrop",
    "app": "SentinelOne"
  },
  {
    "parser": "| json \"event.contexts.client_os.name\", \"event.contexts.client_os.version\", \"event.contexts.browser.name\", \"event.contexts.browser.version\", \"event.environment\", \"level\" as clientOs, clientVersion, browserName, browserVersion, environment, level nodrop",
    "app": "Sentry"
  },
  {
    "parser": "| json \"channelId\", \"teamName\" as ChannelId, Workspace",
    "app": "Slack"
  },
  {
    "parser": "| json field=_raw \"content.user\" as user",
    "app": "Spinnaker"
  },
  {
    "parser": "| json \"type\", \"auditLogType\" as type, auditLogType nodrop",
    "app": "Split"
  },
  {
    "parser": "| parse regex \"(?<time>\\d{4}-\\d{2}-\\d{2}\\s\\d{2}:\\d{2}:\\d{2}.\\d{2,3})\\s+\\S+\"",
    "app": "SQL Server - OpenTelemetry"
  },
  {
    "parser": "| parse regex \"(?<time>\\d{4}-\\d{2}-\\d{2}\\s\\d{2}:\\d{2}:\\d{2}.\\d{2,3})\\s+\\S+\"",
    "app": "SQL Server for Linux - OpenTelemetry"
  },
  {
    "parser": "| json \"event.type\", \"event.resource\" as type, resource nodrop",
    "app": "Squadcast"
  },
  {
    "parser": "| json \"message\" nodrop\n| parse regex field = message \"(?<time>[\\d.]+)\\s+(?<elapsed>[\\d]+)\\s+(?<remotehost>[^\\s]+)\\s+(?<action>[^/]+)/(?<status_code>[\\d]+)\\s+(?<bytes>[\\d]+)\\s+(?<method>[\\w]+)\\s+(?<url>[^\\s]+)\\s(?<rfc931>[^\\s]+)\\s+(?<peerstatus>[^/]+)/(?<peerhost>[^\\s]+)\\s+(?<type>[^\\s\n| $]+?)(?:\\s+\n| $)\" nodrop\n| parse field = message \"Connection: *\\\\r\\\\n\" as connection_status nodrop\n| parse field = message \"Host: *\\\\r\\\\n\" as host nodrop\n| parse field = message \"User-Agent: *\\\\r\\\\n\" as user_agent nodrop\n| parse field = message \"TE: *\\\\r\\\\n\" as te nodrop",
    "app": "Squid Proxy"
  },
  {
    "parser": "| json \"message\" nodrop\n| parse regex field = message \"(?<time>[\\d.]+)\\s+(?<elapsed>[\\d]+)\\s+(?<remotehost>[^\\s]+)\\s+(?<action>[^/]+)/(?<status_code>[\\d]+)\\s+(?<bytes>[\\d]+)\\s+(?<method>[\\w]+)\\s+(?<url>[^\\s]+)\\s(?<rfc931>[^\\s]+)\\s+(?<peerstatus>[^/]+)/(?<peerhost>[^\\s]+)\\s+(?<type>[^\\s\n| $]+?)(?:\\s+\n| $)\" nodrop\n| parse field = message \"Connection: *\\\\r\\\\n\" as connection_status nodrop\n| parse field = message \"Host: *\\\\r\\\\n\" as host nodrop\n| parse field = message \"User-Agent: *\\\\r\\\\n\" as user_agent nodrop\n| parse field = message \"TE: *\\\\r\\\\n\" as te nodrop",
    "app": "Squid Proxy - OpenTelemetry"
  },
  {
    "parser": "| json \"deployment.name\", \"deployment.clusterName\", \"deployment.namespace\" as deployment, cluster, namespace",
    "app": "StackRox"
  },
  {
    "parser": "| json \"type\",\"data.object.object\" as type, object nodrop",
    "app": "Stripe"
  },
  {
    "parser": "| parse \"\\\"cs(User-Agent)\\\": \\\"*\\\"\" as user_agent\n| json \"x-bluecoat-request-tenant-id\", \"date\", \"time\", \"time-taken\", \"x-virus-id\", \"cs-userdn\", \"s-action\", \"cs-host\", \"cs-uri-port\", \"cs-uri-path\", \"s-ip\", \"c-ip\", \"cs-bytes\", \"sc-bytes\", \"cs-categories\", \"sc-filter-result\", \"cs-uri-extension\", \"x-exception-id\", \"x-bluecoat-placeholder\" as id, date, time, total_time, virus_id, user, s_action, host, cs_uri_port, cs_uri_path, s_ip, client_ip, bytes_sent, bytes_received, category, filter_result, uri_extension, exception_id, x_bluecoat_placeholder nodrop",
    "app": "Symantec Web Security Service"
  },
  {
    "parser": "| json \"description\", \"actor.name\", \"target.name\", \"action\" as description, actor_name, target_name, action",
    "app": "Tenable"
  },
  {
    "parser": "| json \"eventTime\",\"eventName\", \"awsRegion\", \"sourceIPAddress\", \"errorCode\",\"userAgent\" as event_time, event_name, aws_region, src_ip, result,user_agent nodrop\n| json \"userIdentity.userName\", \"userIdentity.accountId\" as src_user, accountId nodrop\n| json field=raw \"labels[*].name\" as label_name",
    "app": "Threat Intel for AWS"
  },
  {
    "parser": "| parse regex \"(?<hash_256>\\b[A-Fa-f0-9]{64}\\b)\"\n| json field=raw \"labels[*].name\" as label_name",
    "app": "Threat Intel Quick Analysis"
  },
  {
    "parser": "| extract \"CEF:\\s*0\\\n| (?<Device_Vendor>.*)\\\n| (?<Device_Product>.*)\\\n| (?<Device_Version>.*)\\\n| (?<Signature_ID>.*)\\\n| (?<Name>.*)\\\n| (?<Severity>.*)\\\n| (?<Extension>.*)\"",
    "app": "Trend Micro Deep Security"
  },
  {
    "parser": "| parse regex \"\\s+(?<component>Twistlock-Console\n| Twistlock-Defender?)\\s*.*\\s*time=\\\"\" nodrop\n| parse \"type=\\\"*\\\"\" as type nodrop\n| parse \"log_type=\\\"*\\\"\" as log_type nodrop\n| parse \"hostname=\\\"*\\\"\" as hostname nodrop\n| parse \"vulnerabilities=\\\"*\\\"\" as vulnerabilities nodrop\n| parse \"compliance=\\\"*\\\"\" as compliance nodrop",
    "app": "Twistlock"
  },
  {
    "parser": "| parse regex \"\\s+(?<component>Twistlock-Console\n| Twistlock-Defender?)\\s*.*\\s*time=\\\"\" nodrop\n| parse \"type=\\\"*\\\"\" as type nodrop\n| parse \"pid=\\\"*\\\"\" as pid nodrop\n| parse \"path=\\\"*\\\"\" as path nodrop\n| parse \"interactive=\\\"*\\\"\" as interactive nodrop\n| parse \"md5=\\\"*\\\"\" as md5 nodrop\n| parse \"container_id=\\\"*\\\"\" as container_id nodrop",
    "app": "Twistlock Classic"
  },
  {
    "parser": "| json \"log\" as _rawlog nodrop",
    "app": "Varnish"
  },
  {
    "parser": "| json \"log\" as _rawlog nodrop",
    "app": "Varnish - OpenTelemetry"
  },
  {
    "parser": "| parse \"vm=*,,,\" as vm",
    "app": "VMware"
  },
  {
    "parser": "| parse \"eventType=*,,,\" as event_type",
    "app": "VMware ULM"
  },
  {
    "parser": "| parse \"\\\"id\\\": \\\"*\\\"\" as event_id nodrop\n| parse \"\\\"eventDescription\\\": \\\"*\\\"\" as event_description nodrop\n| parse \"\\\"targetType\\\": \\\"*\\\"\" as target_type nodrop\n| parse \"\\\"targetId\\\": \\\"*\\\"\" as target_id nodrop\n| parse \"\\\"targetName\\\": \\\"*\\\"\" as target_name nodrop\n| parse \"\\\"eventCategory\\\": \\\"*\\\"\" as event_category nodrop\n| parse \"\\\"created\\\": \\\"*\\\"\" as created_time nodrop\n| parse \"\\\"actionText\\\": \\\"*\\\"\" as action_text nodrop\n| parse \"\\\"actorId\\\": \\\"*\\\"\" as actor_id nodrop\n| parse \"\\\"actorName\\\": \\\"*\\\"\" as actor_name nodrop\n| parse \"\\\"actorEmail\\\": \\\"*\\\"\" as actor_email nodrop\n| parse \"\\\"actorOrgId\\\": \\\"*\\\"\" as actor_org_id nodrop\n| parse \"\\\"actorOrgName\\\": \\\"*\\\"\" as actor_org_name nodrop\n| parse \"\\\"actorUserAgent\\\": \\\"*\\\"\" as actor_user_agent nodrop\n| parse \"\\\"actorIp\\\": \\\"*\\\"\" as actor_ip nodrop",
    "app": "Webex"
  },
  {
    "parser": "| parse \"Type = \\\"*\\\";\" as evtType",
    "app": "Windows"
  },
  {
    "parser": "| json \"Channel\", \"EventID\", \"Computer\" nodrop",
    "app": "Windows - Cloud Security Monitoring and Analytics"
  },
  {
    "parser": "| json \"Channel\", \"EventID\", \"Computer\" nodrop",
    "app": "Windows - Cloud Security Monitoring and Analytics - OpenTelemetry"
  },
  {
    "parser": "| json  \"level\", \"keywords\" as level, keywords nodrop",
    "app": "Windows 2012+ - OpenTelemetry"
  },
  {
    "parser": "| json \"Level\", \"Keywords\" as level, keywords",
    "app": "Windows 2012+ (JSON)"
  },
  {
    "parser": "| parse \"Type = \\\"*\\\";\" as evtType",
    "app": "Windows 7+ - 2008 (Legacy)"
  },
  {
    "parser": "| parse regex \"winbox = (?<dest_host>\\S+)\" nodrop",
    "app": "Windows Performance"
  },
  {
    "parser": "| json \"System_Account\", \"Session_IP_Address\", \"tenant_name\" nodrop",
    "app": "Workday"
  },
  {
    "parser": "| json \"event\", \"payload.account_id\", \"payload.operator\" as event, account_id, admin",
    "app": "Zoom"
  },
  {
    "parser": "| json \"sourcetype\", \"event.user\" as sourcetype, user",
    "app": "Zscaler Internet Access"
  },
  {
    "parser": "| json field=_raw \"Username\"",
    "app": "Zscaler Private Access"
  },
  {
    "parser": "| parse \"cat=*\\t\" as category\n|",
    "app": "Zscaler Web Security"
  }
];
