    //master.js
    'use sctrict'
    const util = require('util');
    const path = require('path');
    const fs = require('fs');
    const SETT	= read_settings(path.normalize("./settings.json"));
    const UPDATE_FOLD = SETT.update_folder;

    const LOOK_UPDATE_INTERVAL = SETT.update_folder_watch_timer || 60000; // 1 min
    const RUNNER_SPEED = 2000;


    console.log("UPDATE_FOLD=",UPDATE_FOLD);
    const Server = require('socket.io');
    const io = new Server(SETT.http_p); // or io = require('socket.io')(3000)

    const JOBS =  {
        //this is the name of job to send to Agent
        // 1) нужны ли параметры? 
        // 2) входим только в void_main и оттуда будет вызываться всё остальное  или идём по все функциям в списке
        // 3) нужны ли id задачам или вместо id - уникальные имена
        // 4) на самом деле состояний у задачи может быть в 2 раза больше 
        "void_main": 
        {
			//this is always the first fuction called
            "if_err": 
            {
				"call_":"sample_err_1"
			},
            "if_timeout":			
            {
				"call_":"sample_timeout_1"
			},
            "if_answer": 
            [
				{
					"validate":"is_zero",
                    "if_true": [ 30000, "sample_fuction_02", 10000, "sample_fuction_zero_is_true", "return_" ],
					"if_false": ""
				},
				{
					"validate":"is_one",
					"if_true": "sample_fuction_one_is_true",
					//"if_false":""
				},
                { 
                    "novalidate": [ "sample_fuction_not_zero_or_one", 10, "sample_fuction_01" ]
                }
            ]
        },
        "sample_fuction_02":
        {
            "if_err": 
            {
				"call_":"sample_err_1"
			},
            "if_timeout":			
            {
				"call_":"sample_timeout_1"
			},
            "if_answer": 
            [
				{
					"validate":"is_zero",
                    "if_true": [ 30000, "sample_fuction_02", 10000, "sample_fuction_zero_is_true", "return_" ],
					"if_false": ""
				},
				{
					"validate":"is_one",
					"if_true": "sample_fuction_one_is_true",
					//"if_false":""
				},
                { 
                    "novalidate": [ "sample_fuction_not_zero_or_one", 10, "sample_fuction_01" ]
                }
            ]
        }
    }
    
    //--------------------------------------------
    function start_jobs() {
        task_board(JOBS.void_main);
    }

    //------------JFX------------
    const JFX = {

    }

    //--------CONTROLLER HOUSEKEEPING----------
    const CHK = {
        description: "controller housekeeping",
        ID:0, TYPE:1, SVC_TYPE:2, SVC_TYPE_PARAM:3, PARAMETER:4, ORDERS:5,
        CHECK_VAL:0, RES_VAL:1, LOGIC_OP:2, TRUE_FU:3, FALSE_FU:4, 
        OUT_TIME:6, TRY_AGN_TIME:7, ADD_PARAM:8,
        LIST: [
            [1, "proc", "auto", 0, "ass.exe", [[1, null, "int_lte", "tfunc1", "ffunc1"], [1, null, "int_gte", "tfunc1_2", "ffunc1_2"], [1, null, "int_is_equal", "tfunc1_2", "ffunc1_2"]], 15000, 30000, 0],
            [2, "disk", "auto", 0, "C:", [[26232171968, null, "int_lte", "low_disk_space_true", "big_disk_space"]], 20000, 60000, 0],
            [3, "exec_cmd", "manual", 0, "calc", [[12.0, null, "compare_versions", "exec_cmd_ok", "exec_cmd_fail"]], 20000, 0, 0],
            [4, "nvidia_smi", "manual", 0, "all info", [[1, null, "int_lte", "gpu_absent", "gpu_more_than_1"]], 60000, 0, 0]
            //[6, "nvidia_smi", "manual", 0, "memory usage", [[7, null, "int_gte", "gpu_overload", "gpu_free"]], 20000, 0, 0]
        ],
        find_order_by_id: function(id){
            let index;
            for (let i in CHK.LIST){
                if (CHK.LIST[i][CHK.ID] == id) { index = i; break;  }
            }
            if (typeof index == 'undefined') return [];
            else return CHK.LIST[index];
        }
    };
    const CHK_FX = new function HousekeepingFunctions()
    {
        this.first_dump = function(task, ag_sid){
            //let ag_index = MGS.find_agent_index_by_sid(ag_sid);
            for (let i in CHK.LIST){
                // EXAMPLE: [2, "disk", "auto", 0, "C:", [[1000, null, "int_lte", "tfunc3", "ffunc3"]], 10000, 30000, 0]
                let order = CHK.LIST[i];
                //if(order[CHK.SVC_TYPE] == "auto") {   
                let raw = {parameter: order[CHK.PARAMETER], chk_id: order[CHK.ID]};
                MGS.task_board({t_names: [order[CHK.TYPE]], raws:[raw], stage: MGS.FRESH, sid: ag_sid});
                //}
            }
        };
        this.finalizer = function(task, ag_sid){
            console.log("FINALIZER");
            if (task[MGS.TNAME] == 'exec_cmd') {
                console.log("____EXEC CMD:", task[MGS.ANSWER]);
            }
            else if (task[MGS.TNAME] == 'nvidia_smi') {
                console.log("____NVIDIA SMI:", task[MGS.ANSWER]);
            }
            else if (task[MGS.TNAME] == 'disk') {
                console.log("____DISK:", task[MGS.ANSWER]);
            }
            else if (task[MGS.TNAME] == 'proc') {
                console.log("____PROC:", task[MGS.ANSWER]);
            }
        
            let ag_answer = task[MGS.ANSWER];
            //* Condition catch both Object and Array types:
            //* BASICALY AGENT ANSWER = {result, chk_id}
            if(typeof (ag_answer) == 'object') 
            {
                //housekeeping ID
                let chk_id = ag_answer.chk_id;
                let result = ag_answer.result;
                if (task[MGS.TNAME] == 'proc') { 
                    //res = [] || [{pid, ppid, command, argument}, {...}]
                    if (Array.isArray(result)) { result = result.length; }
                    else { result = 0; }
                }
                //* return [] || [...]
                let order = CHK.find_order_by_id(chk_id);
                if (order.length == 0) { console.log("ERR: CHK_FX.finalizer(): can't find order by chk_id !"); return; }
                //* EXAMPLE: cond = [1, null, "int_lte", "tfunc1", "ffunc1"]
                for (let cond in order[CHK.ORDERS]) 
                {
                    //* PUT RESULT FROM AGENT IN THIS ARRAY IN HOUSEKEEPING
                    order[CHK.ORDERS][cond][CHK.RES_VAL] = result;
                    let logic_op = order[CHK.ORDERS][cond][CHK.LOGIC_OP];
                    let check_val = order[CHK.ORDERS][cond][CHK.CHECK_VAL];

				    if(typeof logic_op !== 'undefined')
				    {
				    	//console.log("logic_op:" + logic_op);
				    	if(typeof this[logic_op] !== 'undefined')
				    	{
				    		//console.log("is not undefined");
				    		if(typeof this[logic_op] === 'function')
				    		{
				    			//console.log("is function");
				    			var logic_result = this[logic_op](result, check_val)
				    			if(logic_result == true)
				    			{
				    				//console.log("is true");
				    				var true_func_name = order[CHK.ORDERS][cond][CHK.TRUE_FU];
				    				if( typeof this[true_func_name] !== 'undefined')
				    				{
				    					if( typeof this[true_func_name] === 'function')
				    					{
				    						CHK_FX[true_func_name](task, ag_sid);/* SEND THE ENTIRE LINE FROM TASKBOARD HERE */
				    					}	
				    				}
				    			}
				    			
				    			if(logic_result == false)
				    			{
				    				var false_func_name = order[CHK.ORDERS][cond][CHK.FALSE_FU];
				    				if( typeof this[false_func_name] !== 'undefined')
				    				{
				    					if( typeof this[false_func_name] === 'function')
				    					{
				    						CHK_FX[false_func_name](task, ag_sid);/* SEND THE ENTIRE LINE FROM TASKBOARD HERE */
				    					}	
				    				}
				    			}
				    		}
				    	}
				    }
                }

                //* PART2: REPLAY IF 'TRY_AGAIN' PARAM EXIST:
                if ( order[CHK.TRY_AGN_TIME] > 0 ) {
                    let timetostart_ = order[CHK.TRY_AGN_TIME] + new Date().getTime();
                    //console.log("timetostart_=",timetostart_);
                    let raw = {parameter: order[CHK.PARAMETER], chk_id: order[CHK.ID]};
                    MGS.task_board({t_names: [order[CHK.TYPE]], raws:[raw], stage: MGS.FRESH, sid: ag_sid, timetostart: timetostart_});   
                }
            }
            else {"ERR: finalizer(): Unexpected type of agent answer !"}
            //* FINALLY, IF ABOVE OPERATIONS WAS synchronous:
            task[MGS.STAGE] = MGS.DONE; 
        };
        //-----------------------------------------
        this.tfunc1 = function(task, ag_sid){
            console.log("hi from tfunc1 !");
        };
        this.ffunc1 = function(task, ag_sid){
            console.log("hi from ffunc1 !");
        };
        this.tfunc1_2 = function(task, ag_sid){
            console.log("hi from tfunc1_2 !");
        };
        this.ffunc1_2 = function(task, ag_sid){
            console.log("hi from ffunc1_2 !");
        };
        this.ffunc2 = function(task, ag_sid){
            console.log("hi from ffunc2 !");
        };
        this.exec_cmd_ok = function(task, ag_sid){
            console.log("hi from exec_cmd_ok !");
        };
        this.exec_cmd_fail = function(task, ag_sid){
            console.log("hi from exec_cmd_fail !");
        };
        this.gpu_absent = function(task, ag_sid){
            console.log("hi from gpu_absent !");
        };
        this.gpu_more_than_1 = function(task, ag_sid){
            console.log("hi from gpu_more_than_1 !");
        };
        this.low_disk_space_true = function(task, ag_sid)
        {
            console.log("LOW DISK SPACE IS TRUE:" + JSON.stringify(task[MGS.ANSWER]) );
            // send console command to controller to launch notepad.exe
        };
        this.big_disk_space = function(task, ag_sid)
        {
            console.log("BIG DISK SPACE:" + JSON.stringify(task[MGS.ANSWER]) );
            // send console command to controller to launch notepad.exe
        };
	
        this.int_lte = function(var1, var2)
        {
            console.log("////////////////////////////////  Iint_lteCALLED //////////////////////");
            //var 1 is answer, var2 is what we are checking against
            console.log(var1, " < ", var2);	
            if(var1 < var2)
            {
                return true;
            }
            return false;
        };
	
        this.int_gte = function(var1, var2)
        {
            console.log("////////////////////////////////  int_gte //////////////////////");	
            console.log(var1, " > ", var2);	
            //var 1 is answer, var2 is what we are checking against
            if(var1 > var2)
            {
                return true;
            }
            return false;
        };
	
        this.int_is_equal = function(var1, var2)
        {
            console.log("////////////////////////////////  IS EQUAL CALLED //////////////////////");
            console.log(var1, " == ", var2);	
            if(var1 == var2)
            {
                return true;
            }
            return false;
        };
    }
    //--------/CONTROLLER HOUSEKEEPING----------

    //--------TASK TEMPLATES AND FUNCTIONS----------
    const TEMPLATES = {
        default: {
            timeout: 5000, blocking: true, aging: 600000,
            start_f:    "start__default",
            complete_f: "complete__default",
            timeout_f:  "timeout__default",
            error_f:    "error__default",
        },
        manifest: {
            timeout: 15000, blocking: false, aging: 600000,
            start_f:    "start__manifest",
            complete_f: "complete__manifest", //own
            timeout_f:  "timeout__default",
            error_f:    "error__default",
        },
        same_md5_agents: {
            timeout: 15000, blocking: false, aging: 600000,
            start_f:    "start__same_md5_agents", //own
            complete_f: "complete__same_md5_agents", //own
            timeout_f:  "timeout__default",
            error_f:    "error__default",
        },
        kill_agent: {
            timeout: 5000, blocking: true, aging: 600000,
            start_f:    "start__kill_agent", //own
            complete_f: "complete__default",
            timeout_f:  "timeout__default",
            error_f:    "error__default",
        },
        housekeeping: {
            timeout: 5000, blocking: true, aging: 600000,
            start_f:    "start__default", 
            complete_f: "complete__housekeeping", //own
            timeout_f:  "timeout__default",
            error_f:    "error__default",
        },
        proc: {
            timeout: 5000, blocking: false, aging: 600000,
            start_f:    "start__default", 
            complete_f: "complete__chk", //chk = controller housekeeping
            timeout_f:  "timeout__default",
            error_f:    "error__default",
        },
        disk: {
            timeout: 5000, blocking: false, aging: 600000,
            start_f:    "start__default", 
            complete_f: "complete__chk", //chk = controller housekeeping
            timeout_f:  "timeout__default",
            error_f:    "error__default",
        },
        exec_cmd: {
            timeout: 20000, blocking: false, aging: 600000,
            start_f:    "start__default", 
            complete_f: "complete__chk", //chk = controller housekeeping
            timeout_f:  "timeout__default",
            error_f:    "error__default",
        },
        nvidia_smi: {
            timeout: 5000, blocking: false, aging: 600000,
            start_f:    "start__default", 
            complete_f: "complete__chk", //chk = controller housekeeping
            timeout_f:  "timeout__default",
            error_f:    "error__default",
        },
    };
    const TFX = new function TaskFunctions() 
    {
        this.start__default = function(task, ag_sid) {
            //* 2) change STAGE to SENT
            task[MGS.STAGE] = MGS.SENT;
            //* 3) Agent.Emit(TNAME, {TID,RAW} )
            let parcel = { tid: task[MGS.TID], payload: task[MGS.RAW] };
            //console.log("start_f_default(): PAYLOAD=", util.inspect(task[MGS.RAW]));
            io.to(ag_sid).emit(task[MGS.TNAME], parcel);
        };
        this.start__kill_agent = function(task, ag_sid) {
            if (task[MGS.TNAME] == 'kill_agent') {
                // TODO: Find same Md5 Partners and UNSHIFT on TOP of those TaskBoard Task with STAGE = MGS.BLOCKED
                let same_md5_agents = MGS.find_same_md5_agents_except_self( {sid: ag_sid} );
                if (Array.isArray(same_md5_agents)) {
                    if (same_md5_agents.length > 0) {
                        let blocking_task = [];
                        blocking_task[MGS.TID] = ++MGS.gcounter;
                        blocking_task[MGS.STAGE] = MGS.BLOCKED;
                        blocking_task[MGS.TNAME] = "BLOCKING_TASK";
                        //* if unexpectedly we have more than one same md5 agents
                        for (let i in same_md5_agents) { 
                            let sid = same_md5_agents[i][MGS.SID];
                            let agent_index = MGS.find_agent_index_by_sid(sid);
                            MGS.agents[agent_index][MGS.TASKS].unshift(blocking_task); }
                    }
                }
                this.start__default(task, ag_sid);
            };
        };
        this.start__manifest = function(task, ag_sid) {
            task[MGS.STAGE] = MGS.SENT;
            let parcel = { tid: task[MGS.TID], payload: JSON.stringify(MGS.manifest.self) };
            io.to(ag_sid).emit(task[MGS.TNAME], parcel);
        };
        this.start__same_md5_agents = function(task, ag_sid){
            let same_md5_agents = MGS.find_all_same_md5_agents( {sid: ag_sid} );
            task[MGS.RAW] = JSON.stringify(same_md5_agents);
            this.start__default(task, ag_sid);
        };
        this.complete__default = function(task, ag_sid) {
            task[MGS.STAGE] = MGS.DONE; 
        };
        this.complete__chk = function(task, ag_sid) {
            // Pass instruction like 'what you must to do finally', e.g. {type:arr, obj: 'task', el: 'MGS.STAGE', val: 'MGS.DONE'}
            CHK_FX.finalizer(task, ag_sid);
            task[MGS.STAGE] = MGS.DONE; 
        };
        this.complete__manifest = function(task, ag_sid) {
            //* if task was in bundle with another task, e.g. 'manifest' with 'same_md5_agents'
            if ( typeof task[MGS.BUNDLE] == 'same_md5_agents' ) {
                MGS.task_board( {t_names:['same_md5_agents'],
                                timetostart_: (5000 + new Date().getTime()),
                                stage: MGS.FRESH, 
                                sid: ag_sid } );
            }
            task[MGS.STAGE] = MGS.DONE;
        };
        this.complete__same_md5_agents = function(task, ag_sid) {
            let is_partner_exist = task[MGS.ANSWER]; // true || false
            //? maybe there was a chain of tasks 'manifest'->'same_md5_agents' because based on this info we decide what agent will next chain do
            if ( typeof task[MGS.BUNDLE] == 'manifest' ) {
                let prev_manifest_task = MGS.find_prev_task_by_tname({tname: 'manifest', sid: ag_sid});
                if (prev_manifest_task == -1) {
                    //? Значит мы хотели найти предыдущее задание типа 'manifest', но почему-то не нашли
                    console.log("ERR: Fail to find previous 'manifest' task! tid=", task[MGS.TID]);               
                }
                else {
                    //? typeof diff = Boolean || {is_diff: true, is_touch_partner_folder: false}
                    let diff = prev_manifest_task[MGS.ANSWER];
                    
                    let t_names;
                    //? answer of launcher-------------
                    if (typeof diff == 'boolean') {
                        if (diff) {
                            if(is_partner_exist) { t_names = ['kill_agent', 'sync_dirs', 'start_agent']; }
                            else { t_names = ['sync_dirs', 'start_agent']; }
                        }
                        else {
                            if(is_partner_exist) { }
                            else { t_names = ['start_agent']; }
                        }
                    }
                    //? answer of controller----------
                    else if (typeof diff == 'object') {
                        if (diff.is_diff) {
                            if (diff.is_touch_partner_folder) {   
                                if(is_partner_exist) { t_names = ['kill_agent', 'sync_dirs', 'start_agent'];  }
                                else {  t_names = ['sync_dirs', 'start_agent']; }
                            }
                            else {
                                if(is_partner_exist) { t_names = ['sync_dirs']; }
                                else {  t_names = ['sync_dirs', 'start_agent']; }
                            }
                        }
                    }
                }
        
                //? if agent is Controller then send him 'housekeeping' task
                let agent_index = MGS.find_agent_index_by_sid(ag_sid);
                if (agent_index == -1) {
                    console.log("complete__same_md5_agents(): fail to get agent_index");
                    return;
                }
                if(MGS.agents[agent_index][MGS.TYPE] == "controller") { 
                    t_names.push('housekeeping'); 
                }
                MGS.task_board( {t_names:t_names, stage: MGS.FRESH, sid: ag_sid } );
                this.complete__default(task, ag_sid);
            } 
            
            else {
                //? Means that this task 'same_md5_agents' was a standalone task
                if(is_partner_exist == false) {
                    MGS.task_board( {t_names:['start_agent'], sid: ag_sid, stage: MGS.FRESH} );
                }
            }
        };
        this.complete__housekeeping = function(task, ag_sid){
            CHK_FX.first_dump(task, ag_sid);
            // IN THE END WE MUST CHANGE TASK STAGE TO "DONE" VALUE
            this.complete__default(task, ag_sid);
        };
        this.timeout__default = function(task, ag_sid) {
            //TODO: FIND ALL CHAIN TASKS BY 'NEXT_TID' TAIL AND CHANGE THEY STATES TO 'TIMEOUT' OR 'ERR'
            console.log("!!!! DEFAULT TIMEOUT FUNCTION !!!!");
            console.log("task name:", task[MGS.TNAME], ", agent sid:", ag_sid);
        };
        this.error__default = function(task, ag_sid) {
            //TODO: FIND ALL CHAIN TASKS BY 'NEXT_TID' TAIL AND CHANGE THEY STATES TO 'ERR'
            console.log("!!!! DEFAULT ERROR FUNCTION !!!!");
            console.log("task name:", task[MGS.TNAME], ", agent sid:", ag_sid);
        };
    }

    //--------/TASK TEMPLATES AND FUNCTIONS----------
    
    //--------VISUALIZER FOR BROWSERS----------
	var list_of_subscribers = [];
	function manage_subscribers(socket_id, action)
	{
		var found = 0;
		var found_loc = [];
		for(var i = 0; i<list_of_subscribers.length; i++)
		{
			
			if(list_of_subscribers[i] == socket_id)
			{
				found = found + 1;
				found_loc.push(i);
			}
		}
		
		if(found == 0 && action == 'add')
		{
			list_of_subscribers.push(socket_id)
		}
		else if(found > 0 && action == 'remove')
		{
			for(var i = 0; i < found_loc.length; i++)
			{
				list_of_subscribers.splice(found_loc[i], 1);
			}
		}
		
		//console.log(list_of_subscribers);
	}
	function transmit_info_to_browsers(data)
	{
		for(var i = 0; i<list_of_subscribers.length; i++)
		{
			io.to(list_of_subscribers[i]).emit('agent_table', data);
		}
	}
    //--------/VISUALIZER FOR BROWSERS----------

// Master Global Structure
const MGS = {
    //[ ["launcher", "eD9iEX2094atE1eaAAAA", "8390m28384r", "192.168.0.100", 3922, 4425, "updating launcher", [[uid1,task1,1,0],[uid2,task2,0,0],..] ], [...]  ]
    agents: [ ],
    gcounter: 0,
    TYPE:0, SID:1, MD5:2, IP:3, PID:4, PPID:5, STATE:6, TASKS:7,
    TID:0, TNAME:1, STAGE:2, RAW:3, ANSWER:4, NEXT_TID:5, TMPL:6, TIMEPUSH:7, TIMESENT:8, TIMEEXTRA:9, TIMETOSTART:10, BUNDLE: 11, AGING: 12,
    FRESH:0, SENT:1, GOT:2, DONE:3, EXTRA:4, ERR:5, BLOCKED:6, //STAGES !
    main: function(){
        //TFX = new TaskFunctions();
        MGS.set_io_lisners(io);
        // at the beginning request dir manifest and send to agents
        get_dir_manifest(UPDATE_FOLD).then(res => {
            console.log("got update manifest...");
            //MGS.manifest.mark_init_ready(res);
            this.manifest.is_ready_on_init = true;
            this.manifest.self = manifest;
            //* light trick at the beginning, when some agents are already connected, but manifest was not ready
            MGS.manifest.notify_deaf();
            //* look for changes in update folder
            MGS.manifest.start_monitor_changes(UPDATE_FOLD);
        }).catch(ex => { console.log("fail getting manifest: ex:", ex); });
        MGS.call_runner(RUNNER_SPEED);
    },
    set_io_lisners: function(io){
        //io.serveClient(false);
    io.on('connection', client => {
        console.log("<< client connected:", client.id);
        //just in case - if  recipient can't read the settings file
        MGS.io_outbox({event:'update_folder', client: client, payload: SETT.update_folder});
        //SENDING REQUEST FOR IDS

		client.on('disconnect', info => 
		{
			MGS.unsubscribe_agent(client); 
			manage_subscribers(client.id, 'remove');	
		});

		client.on('get_socket_id', data =>
		{
			// we know this is browser
			console.log("get_socket_id recevied: "+ data);
			var this_socket_id = client.id;
			manage_subscribers(this_socket_id, 'add');
			io.to(this_socket_id).emit('id_assigned', this_socket_id);
		});
		
        client.on('report', data_ => {
            let data = (data_) ? (data_) : {};
            console.log("<<< Agent 'report': ", data.title);
            //let agent_index = MGS.find_agent_index_by_sid(client.id);
            switch (data.title)
            {
                case "identifiers":
                    //? 1) data.done - means that everything all right
                    if (data.done) {
                        //? payload - this is agent identifiers. 
                        if (data.payload) {
                            MGS.subscribe_agent(client, data.payload);
                            MGS.task_board({ t_names: ["manifest"], stage: MGS.FRESH, sid: client.id, bundle: ["same_md5_agents"] });
                        }
                        else { console.log("ERR: Agent's identifiers are empty! Can't subscribe agent !"); }
                    } 
                    else { console.log("ERR: client can't prepare identifiers: cause:", data.cause); }
                    break;
                //* Agent confirms that it has been received manifest
                case "manifest":
                case "same_md5_agents":
                case "kill_agent":
                case "sync_dirs":
                case "start_agent":
                case "housekeeping":
                case "disk":
                case "proc":
                case "exec_cmd":
                case "nvidia_smi":
                    MGS.task_board( {tid: data.tid, answer: data.answer, stage: MGS.GOT, sid: client.id } );
                    break;
                case undefined:
                    console.log("incoming 'report' event without data!");
                    break;
                default:
                    console.log("UNKNOWN IO REPORT !");
            }
        });
        
        client.on('report_error', err_ => {
            let agent_i = find_agent_index_by_sid(client.id);
            if(typeof agent_i == 'undefined') {
                //? it seems like error was critical and client was destroyed immediately after this message
            }

            console.log("error report from " + client.id + ":" + err_);
        });

        client.on('request_action', data_ => {
            let data = (data_) ? (data_) : {};
            console.log("<<< socket 'request_action' event:", data.title);
            //* find Agent or subscribe if not yet subscribed
            //* perhaps this is unnecessary. subscribing already was on 'report identifiers' event
            let requester_index = MGS.self_subscribe_agent_and_get_index;
            for (let i in data.titles) {
            switch (data.titles[i]){
                //* 'data.from' property can be "launcher" or "controller"
                case undefined:
                    console.log("incoming 'request_action' event without data!");
                    break;
                default:
                    console.log("UNKNOWN ACTION REQUEST !");
            }
            }
        });
        client.on('request_info', data_ => {
            let data = (data_) ? (data_) : {};
            console.log("<<< socket 'request_info' event:", data.title);
            switch (data.title){
                //* client want to get identifiers of agents which runs on the same machine
                case "same_md5_agents":
                    let same_md5_agents = MGS.find_same_md5_agents_except_self({sid: client.id});
                    MGS.io_outbox({event:'same_md5_agents', client: client, payload: same_md5_agents});
                    break;
                case "manifest":
                    break;
                case undefined:
                    console.log("incoming 'request_info' event without data!");
                    break;
                default:
                    console.log("UNKNOWN INFO REQUEST !");
            }
        });
	});    
	/*
	setTimeout(()=>{
		console.log("attaching http server..");
		io.attach(http_srv);
	}, 4000);
	*/
    },
    io_outbox: function(args){
        if (args) {
            if (!args.client) {throw "Error: empty 'client' param"}
            switch (args.event) {
                // From: MGS.manifest.start_monitor_changes()
                case 'identifiers':
                case 'manifest':
                //* em.data: {update_folder: SETT.update_folder}
                case "update_folder":
                case "update_agent":
                case "same_md5_agents":
                    //data.client.emit(data.event, data.payload);
                    args.client.emit(args.event, args.payload);
                    break;
                case "kill_agent":
                    if(args.taskboard){
                        //* Mean - COntains emitter object to wait Answer
                        args.payload.taskboard = args.taskboard;
                        args.client.emit(args.event, args.payload, ack=>{console.log("acknowledgements!")});
                    }
                    break;
                default:
                    console.log("io_outbox(): unknown event");
            }
        }
        else { console.log("no params in io_outbox() !"); }
    },
    call_runner: function(speed)
	{
        let runner_interval = setInterval(()=>
		{
			transmit_info_to_browsers(MGS.agents)
            //* the runner runs through all the agents every 1 sec
            //console.log("runner...");
            for (let i in MGS.agents) {
                let tlist = MGS.agents[i][MGS.TASKS];
                //console.log("runner: agent:", i, " tlist length:", tlist.length);
                //* goes to the agent's tlist
                for (let t in tlist) {
                    let tasks_loop_break = false;
                    let timelast = null;
                    
                    switch (tlist[t][MGS.STAGE]) {
                        case MGS.FRESH:
                            //console.log("runner: TIMETOSTART=", tlist[t][MGS.TIMETOSTART]);
                            //console.log("runner: TIME NOW=", new Date().getTime());
                            if(typeof (tlist[t][MGS.TIMETOSTART]) == "undefined" ) { 
                                tlist[t][MGS.TIMETOSTART] = new Date().getTime(); 
                            }
                            if(tlist[t][MGS.TIMETOSTART] <= new Date().getTime()) {
                                tlist[t][MGS.STAGE] = MGS.SENT;
                                tlist[t][MGS.TIMESENT] = new Date().getTime();
                                //* 1) call task's start_f to make all necessary actions
                                //console.log("TEMPLATES=",JSON.stringify(TEMPLATES));
                                //console.log("tlist[t][MGS.TMPL]=", tlist[t][MGS.TMPL]);
                                TFX[TEMPLATES[tlist[t][MGS.TMPL]].start_f](tlist[t], MGS.agents[i][MGS.SID]);
                                //* 2) if task has 'blocking' type - then exit Tasklist
                                if (TEMPLATES[tlist[t][MGS.TMPL]].blocking){ tasks_loop_break = true; }
                                break;
                            }

                        case MGS.SENT:
                            //* TODO: need to make a timeout decision !
                            //* 1) get TIMEOUT from TMPL
                            timelast = new Date().getTime() - tlist[t][MGS.TIMESENT];
                            //* 2) Compare CUR_TIME with TIMEPUSH
                            if (timelast > TEMPLATES[tlist[t][MGS.TMPL]].timeout) {
                                TFX[TEMPLATES[tlist[t][MGS.TMPL]].timeout_f](tlist[t], MGS.agents[i][MGS.SID]);
                            }
                            //* 3) if (TIMEOUT) => TMPL.timeout_f()
                            //*    else exit Tasklist
                            if (TEMPLATES[tlist[t][MGS.TMPL]].blocking){ tasks_loop_break = true; }
                            //else { console.log("runner: case SENT: non-blocking task!"); }
                            break;
                        case MGS.GOT:
                            //? 1) change STAGE to EXTRA
                            tlist[t][MGS.STAGE] = MGS.EXTRA;
                            tlist[t][MGS.TIMEEXTRA] = new Date().getTime();
                            //? 2) exec TMPL.complete_f()
                            TFX[TEMPLATES[tlist[t][MGS.TMPL]].complete_f](tlist[t], MGS.agents[i][MGS.SID]);
                            //? 3) exit Tasklist
                            if (TEMPLATES[tlist[t][MGS.TMPL]].blocking){ tasks_loop_break = true; }
                            break;
                        case MGS.EXTRA:
                            //* TODO: need to make a timeout decision !
                            //* 1) get TIMEOUT from TMPL
                            timelast = new Date().getTime() - tlist[t][MGS.TIMEEXTRA];
                            //* 2) Compare CUR_TIME with TIMEEXTRA
                            if (timelast > TEMPLATES[tlist[t][MGS.TMPL]].timeout) {
                                TFX[TEMPLATES[tlist[t][MGS.TMPL]].timeout_f](tlist[t], MGS.agents[i][MGS.SID]);
                            }
                            //* 3) if (TIMEOUT) => TMPL.error_f()
                            //*    else exit Tasklist
                            if (TEMPLATES[tlist[t][MGS.TMPL]].blocking){ tasks_loop_break = true; }
                            //else { console.log("runner: case EXTRA: non-blocking task!"); }
                            break;
                        case MGS.DONE:
                            //* 1) Do Nothing. it will Go to the Next Task
                            break;
                        case MGS.ERR:
                            //* TODO: maybe repeat task or chain of tasks ???
                            TFX[TEMPLATES[tlist[t][MGS.TMPL]].error_f](tlist[t], MGS.agents[i][MGS.SID]);
                            if (TEMPLATES[tlist[t][MGS.TMPL]].blocking){ tasks_loop_break = true; }
                            break;
                        case MGS.BLOCKED:
                            //* TODO: need to make a timeout decision !
                            tasks_loop_break = true; 
                            break;
                        case undefined:
                            console.log("ERR: call_runner(): STAGE undefined !");
                            //if (TEMPLATES[tlist[t][MGS.TMPL]].blocking){ tasks_loop_break = true; }
                            break;
                        default:
                            console.log("ERR: call_runner(): unknown STAGE !");
                            //if (TEMPLATES[tlist[t][MGS.TMPL]].blocking){ tasks_loop_break = true; }
                            break;
                    }
                    //* break tlist loop
                    if (tasks_loop_break) break;
                }
            }
        }, speed);
    },
    task_board: function(arg_) {
        //* arg = { t_names:Array, raws:Array, stage:Number, sid:String, template:Object }
        //* 'stage' can be: "new", "gone", "done", maybe also "err"
        let arg = (arg_)?(arg_):{};
        if (!arg.raws) arg.raws = [];
        if (Object.keys(arg).length == 0) { console.log("ERR: task_board(): entry params are empty !"); return; }
        
        //? arg.sid == "all" - it means put task to all Agents
        if(arg.sid == "all") {
            for (let a in MGS.agents) {
                for (let tn in arg.t_names) {
                    let one_task = [];
                    one_task[MGS.TID] = ++MGS.gcounter;
                    one_task[MGS.TNAME] = arg.t_names[tn];
                    one_task[MGS.RAW] = arg.raws[tn];
                    one_task[MGS.STAGE] = arg.stage;
                    one_task[MGS.TIMEPUSH] = new Date().getTime();
                    one_task[MGS.TIMETOSTART] = arg.timetostart;
                    one_task[MGS.BUNDLE] = arg.bundle;
                    //? explicitly specified template
                    if (arg.template) { one_task[MGS.TMPL] = arg.template; }
                    else {
                        //? If template Exists with name that matches with task name:
                        if (TEMPLATES[arg.t_names[tn]]) { 
                            one_task[MGS.TMPL] = arg.t_names[tn]; 
                            //? how much this task will live in tasklist and then deleted 
                            one_task[MGS.AGING] = TEMPLATES[arg.t_names[tn]]['aging']; 
                        }
                        else {
                            one_task[MGS.TMPL] = "default"; 
                            one_task[MGS.AGING] = TEMPLATES['default']['aging']; 
                        }
                    }
                    if (arg.t_names[tn+1]) { one_task[MGS.NEXT_TID] = MGS.gcounter + 1; }
                    MGS.agents[a][MGS.TASKS].push(one_task);
                }
            }
        }
        else {
            if (arg.stage == MGS.FRESH) {
                console.log("task_board: new tasks:", arg.t_names);
                
                let checks = check_tnames_and_raws(arg);
                if ( checks.done == false) { console.log(checks.msg); return; }
                
                let agent_index = MGS.find_agent_index_by_sid(arg.sid);
                if (typeof agent_index == 'undefined') {
                    console.log("task_board ERR: fail to find agent by sid !");
                    return;
                }
                //? if tlist of this agent does not exist yet
                let t_list = MGS.agents[agent_index][MGS.TASKS];
                //? if Agent does not have its own tasklist, let's create it
                if (!Array.isArray(t_list)) { MGS.agents[agent_index][MGS.TASKS] = []; }
                //? loop for all tasks of Agent's tasklist 
                for (let tn=0; tn < arg.t_names.length; tn++) {
                    //console.log("arg.t_names["+tn+"]="+arg.t_names[tn]);
                    let one_task = [];
                    one_task[MGS.TID] = ++MGS.gcounter;
                    one_task[MGS.TNAME] = arg.t_names[tn];
                    one_task[MGS.RAW] = arg.raws[tn];
                    one_task[MGS.STAGE] = arg.stage;
                    one_task[MGS.TIMEPUSH] = new Date().getTime();
                    one_task[MGS.TIMETOSTART] = arg.timetostart;
                    one_task[MGS.BUNDLE] = arg.bundle;
                    if (arg.template) { one_task[MGS.TMPL] = arg.template; }
                    else {
                        //* If Exist template with name that mathes with task name:
                        if (TEMPLATES[arg.t_names[tn]]) {
                            one_task[MGS.TMPL] = arg.t_names[tn];
                            //time after runner will erase this task from tasklist
                            one_task[MGS.AGING] = TEMPLATES[arg.t_names[tn]]['aging'];
                        }
                        else {
                            one_task[MGS.TMPL] = "default"; 
                            //time after runner will erase this task from tasklist
                            one_task[MGS.AGING] = TEMPLATES['default']['aging'];
                        }
                    }
                    //* if exist next task in chain, then make pointer to next tid
                    if (arg.t_names[tn+1]) { one_task[MGS.NEXT_TID] = MGS.gcounter + 1; }
                    //? Put new Task in Agent's tasklist !
                    MGS.agents[agent_index][MGS.TASKS].push(one_task);
                }
                //if (arg.block_partner) {}
            }
            //* the response was received from the agent
            else if (arg.stage == MGS.GOT) {
                //* arg = {tid: data.tid, t_names: ["manifest"], answer: data.is_diff, stage: MGS.GOT, sid: client.id }
                // Find Task in Tasklist and change STAGE
                if (arg.tid) {
                    let task = MGS.find_task_by_tid_and_sid({tid: arg.tid, sid: arg.sid});
                    if (Array.isArray(task)){ 
                        task[MGS.STAGE] = arg.stage; 
                        if (arg.answer) { task[MGS.ANSWER] = arg.answer;  }
                    }
                    else { console.log("ERR: task_board(): task type is Not an Array !"); }
                } 
                else { console.log("ERR: task_board(): STAGE 'GOT': No TID !"); }
            }
            else { console.log("ERR: task_board(): unexpected STAGE !"); }
        }
        function check_tnames_and_raws(arg){
            let checks = {};
            checks.done = true;
            if (!Array.isArray(arg.t_names)) {checks.msg = "ERR: task_board(): 't_names' param must be an Array type !"; checks.done = false;}
            if (!Array.isArray(arg.raws)) {checks.msg = "ERR: task_board(): 'raws' param must be an Array type !"; checks.done = false;}
            if (arg.t_names.length != arg.raws.length) {checks.msg = "ERR: task_board(): 'raws' and 't_names' param must be the same length !"; checks.done = false;}
            return checks;
        }
    },
     
    manifest: {
        self: null,
        is_ready_on_init: false,
        mark_init_ready: function(manifest) {
            this.is_ready_on_init = true;
            this.self = manifest;
        },
        deaf_list: [],
        add_to_deaf_list: function(client) {
            this.deaf_list.push(client);
        },
        notify_deaf: function() {
            if (this.deaf_list.length > 0) {
                for (let client in this.deaf_list) {
                    this.deaf_list[client].emit('manifest', this.self);
                }
                this.deaf_list = [];//clear
            }
        },
        start_monitor_changes: function(upd_fold){
            setInterval(()=>{
                // CLONE BUT NOT REFERENCE
                let old_manifest = MGS.manifest.self;
                console.log("checking updates...");
                // if it is a folder, then additional property 'emty_dir' with index '3'
                get_dir_manifest(upd_fold).then(manifest => {
                    MGS.manifest.self = manifest;
                    //console.log("comparing updates...");
                    let is_diff = MGS.manifest.compare(old_manifest, manifest);
                    //if (diff) MGS.io_outbox({event: 'manifest', payload: manifest});
                    if (is_diff) {
                        MGS.task_board({t_names: ["manifest"], raws: [JSON.stringify(manifest)],  stage: MGS.FRESH, sid: "all" });
                    }
                }).catch(ex => { console.log("ERR:", ex); });
            }, LOOK_UPDATE_INTERVAL);
        },
        compare: function(old, fresh){
            if ((old)&&(old.length > 0)&&(fresh)&&(fresh.length > 0)){
                let changes = compare_manifests_2rp(old, fresh);
                //console.log("CHANGES====", changes);
                if ((changes.copy_names.length > 0) || (changes.empty_dirs.length > 0)) {
                    console.log("there are update files!");
                    return true;
                } else {
                    console.log("no updates ...");
                    return false;
                }
            }
        },
    },
    subscribe_agent: function(client, identifiers){
        console.log("subscribe_agent():", client.id);
        if (identifiers){
            identifiers[MGS.SID] = client.id;
            identifiers[MGS.IP] = client.handshake.address;
            identifiers[MGS.TASKS] = [];
            this.agents.push(identifiers);
            return this.agents.length - 1;
        } else {
            console.log("subscribe_agent(): Empty 'identifiers' param !");
            return -1;
        }

    },
    unsubscribe_agent: function(client) {
        if (this.agents.length > 0) {
            for (let i in this.agents) {
                if (this.agents[i][MGS.SID] == client.id) {
                    this.agents.splice(i, 1);
                    break;
                }
            }
        }
    },
    self_subscribe_agent_and_get_index: function(client, identifiers){
        let requester_index = MGS.find_agent_index_by_sid(client.id);
            if (!requester_index) {
                MGS.subscribe_agent(client, identifiers);
                requester_index = MGS.agents.length - 1;
            }
        return requester_index;
    },
    find_all_same_md5_agents: function(arg){
        //* arg = {identifiers: []} or {sid: <soket.id>}
        //* if 'with_tlist' param is exist, then return agents with they tasks
        let res = [];
        if (arg){
            let md5_ = null;
            if (arg.identifiers){ md5_ = arg.identifiers[MGS.MD5]; }
            else if(arg.sid) {
                let requester_index = this.find_agent_index_by_sid(arg.sid);
                md5_ = MGS.agents[requester_index][MGS.MD5];
            }
            else { console.log("ERR: find_all_same_md5_agents(): wrong params: expect 'sid' or 'identifiers'!"); }
            if (!md5_) { console.log("ERR: find_all_same_md5_agents(): can't find 'MD5' of Requester !"); }
            //* Find client with the same MD5
            
            for (let i in MGS.agents) {
                if (MGS.agents[i][MGS.MD5] == md5_) {
                    if(arg.with_tlist) { res.push(MGS.agents[i]);  }
                    else { 
                        let arr = [];
                        arr[MGS.TYPE] = MGS.agents[i][MGS.TYPE];
                        arr[MGS.MD5]  = MGS.agents[i][MGS.MD5];
                        arr[MGS.SID]  = MGS.agents[i][MGS.SID];
                        arr[MGS.IP]   = MGS.agents[i][MGS.IP];
                        arr[MGS.PID]  = MGS.agents[i][MGS.PID];
                        arr[MGS.PPID] = MGS.agents[i][MGS.PPID];
                        res.push(arr); 
                    }
                    
                }
            }
        }
        else { console.log("ERR: find_all_same_md5_agents(): empty params!"); }
        return res;
    },
    find_same_md5_agents_except_self: function(arg){
        //* arg = {identifiers: []} or {sid: <soket.id>}
        //* if 'with_tlist' param is exist, then return agents with they tasks
        //console.log("find_same_md5_agents_except_self(): arg=", arg);
        let res = [];
        if (arg){
            let md5_ = null, sid_ = null, type_ = null;
            if (arg.identifiers){
                md5_ = arg.identifiers[MGS.MD5];
                sid_ = arg.identifiers[MGS.SID];
                type_ = arg.identifiers[MGS.TYPE];
            }
            else if(arg.sid) {
                let requester_index = this.find_agent_index_by_sid(arg.sid);
                md5_ = MGS.agents[requester_index][MGS.MD5];
                sid_ = MGS.agents[requester_index][MGS.SID];
                type_ = MGS.agents[requester_index][MGS.TYPE];
            }
            if (!md5_) return "cant find MD5";
            if (!sid_) return "cant find SID";

            //console.log("MGS.agents =", JSON.stringify(MGS.agents));
            
            for (let i in MGS.agents) {
                //* Find client with the same MD5
                if (MGS.agents[i][MGS.MD5] == md5_) {
                    //* If it's not himself
                    if(MGS.agents[i][MGS.SID] != sid_) {
                        //* And not same type
                        if(MGS.agents[i][MGS.TYPE] != type_) {
                            if(arg.with_tlist) { res.push(MGS.agents[i]);  }
                            else { 
                                let arr = [];
                                arr[MGS.TYPE] = MGS.agents[i][MGS.TYPE];
                                arr[MGS.MD5]  = MGS.agents[i][MGS.MD5];
                                arr[MGS.SID]  = MGS.agents[i][MGS.SID];
                                arr[MGS.IP]   = MGS.agents[i][MGS.IP];
                                arr[MGS.PID]  = MGS.agents[i][MGS.PID];
                                arr[MGS.PPID] = MGS.agents[i][MGS.PPID];
                                res.push(arr); 
                            }
                        }
                    }
                }
            }
        }
        return res;
    },
    //returns number or undefined
    find_agent_index_by_sid: function(sid){
        let requester_index;
        for (let i in this.agents) {
            if (this.agents[i][MGS.SID] == sid) {requester_index = i; break;};
        }
        return requester_index;
    },
    find_task_by_tid_and_sid: function(obj) {
        //* obj = {tid, sid}
        let task;
        if ((obj.sid)&&(obj.tid)) {
            let agent_index = MGS.find_agent_index_by_sid(obj.sid);
            if (agent_index) {
                let tlist = MGS.agents[agent_index][MGS.TASKS];
                if (Array.isArray(tlist)) {
                    for (let t in tlist) {
                        if (tlist[t][MGS.TID] == obj.tid) {
                            task = tlist[t];
                            break;
                        }
                    }    
                }
            }
        } else { console.log("ERR: find_task_by_tid_and_sid(): No params 'sid' or 'tid'"); }
        return task;
    },
    find_task_by_next_tid: function(arg) {
        //* arg = {tid, sid}
        //console.log("find_task_by_next_tid(): arg=", arg);
        let task;
        if ((arg.sid)&&(arg.tid)) {
            let agent_index = MGS.find_agent_index_by_sid(arg.sid);
            //console.log("find_task_by_next_tid(): agent_index=", agent_index);
            if (typeof(agent_index) != "undefined") {
                let tlist = MGS.agents[agent_index][MGS.TASKS];
                if (Array.isArray(tlist)) {
                    for (let t in tlist) {
                        //console.log("find_task_by_next_tid(): tlist["+t+"]="+tlist[t]);
                        if (tlist[t][MGS.NEXT_TID] == arg.tid) {
                            task = tlist[t];
                            break;
                        }
                    }    
                }
            }
        }  else { console.log("ERR: find_task_by_next_tid(): No params 'sid' or 'next_tid'"); }
        return task;
    },
    find_prev_task_by_tname: function(arg){
        //* arg = {tname: 'manifest', sid: ag_sid}
        if ((arg.sid)&&(arg.tname)) {
            let agent_index = MGS.find_agent_index_by_sid(arg.sid);
            if (typeof(agent_index) == "undefined") { 
                console.log("ERR: find_prev_task_by_tname(): Fail to Find agent by 'sid'");
                return;
            }
            let task;
            let tlist = MGS.agents[agent_index][MGS.TASKS];
            if (Array.isArray(tlist)) {
                for (let t = tlist.length-1; t >= 0; t--) {
                    //console.log("find_task_by_next_tid(): tlist["+t+"]="+tlist[t]);
                    if (tlist[t][MGS.TNAME] == arg.tname) {
                        task = tlist[t];
                        break;
                    }
                }    
            }
            return task;
        }
        else { console.log("ERR: find_prev_task_by_tname(): No params 'sid' or 'tname'"); }
    },
};

//-----I-M-P-L-E-M-E-N-T-A-T-I-O-N-----
MGS.main();
//---------------------------------------



//------------------------------
// EXTERNAL FUNCTIONS
//------------------------------

function req_res_func(request, response)
{
	console.log('request ', request.url);
	var filePath = '.' + request.url;
    if (filePath == './') {
        filePath = './index.html';
    }
	var mimeTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.woff': 'application/font-woff', '.ttf': 'application/font-ttf', '.eot': 'application/vnd.ms-fontobject', '.otf': 'application/font-otf', '.wasm': 'application/wasm' };
	var extname = String(path.extname(filePath)).toLowerCase();
	var contentType = mimeTypes[extname] || 'application/octet-stream';
	fs.readFile(filePath, function(error, content) {
        if (error) {
            if(error.code == 'ENOENT') {
                fs.readFile('./404.html', function(error, content) {
                    response.writeHead(404, { 'Content-Type': 'text/html' });
                    response.end(content, 'utf-8');
                });
            }
            else {
                response.writeHead(500);
                response.end('Sorry, check with the site admin for error: '+error.code+' ..\n');
            }
        }
        else {
            response.writeHead(200, { 'Content-Type': contentType });
            response.end(content, 'utf-8');
        }
    });
}

function config_app(app)
{
	app.disable('x-powered-by');
	app.use(function (req, res, next)
	{
		res.setHeader("Access-Control-Allow-Origin", WEB_FULL_NAME);
		res.setHeader('Access-Control-Allow-Credentials', true);
		res.setHeader("X-Frame-Options", "DENY");
		res.setHeader("X-XSS-Protection", "1");
		res.setHeader("Cache-Control", "no-store");
		res.setHeader("default-src", "none");
		next();
	});
}

function read_settings(json_path)
{
	try	{
		//const json = fs.readFileSync(json_path, "utf8");
		let settings = JSON.parse(fs.readFileSync(json_path, "utf8"));

		if (settings) return settings;
		else {
			console.log("wrong settings data")
			return {error: "wrong settings data"};
		}
	}
	catch (e) {
		console.error("JSON PARSE ERROR: ", e);
		return {error: e};
	}
}

function get_dir_manifest(look_path) {
    return new Promise((resolve, reject) => {
        var walk = function(dir, root_path, done) {
            var results = [];
            fs.readdir(dir, function(err, list) {
                if (err) return done(err);
                //* dir  - is inner directory of root dir, so we trim the root part and get relative path
                let rel_path = (dir.length > root_path.length) ? dir.slice(root_path.length) : "";
                var pending = list.length;
                if (!pending) return done(null, results);
                //*list = array of files names in directory
                list.forEach(function(file) {
                    let rel_file_path = rel_path + "\\" + file;
                    //same: file = dir + "\\" + file;
                    file = path.resolve(dir, file);
                    fs.stat(file, function(err, stat) {
                        if (stat && stat.isDirectory()) {
                            walk(file, root_path, function(err, res) {
                                if (res.length == 0) { 
                                    let dir_res = [];
                                    dir_res.push(rel_file_path);
                                    dir_res.push(stat.size);
                                    dir_res.push(stat.mtime);
                                    dir_res.push("empty_dir");
                                    results.push(dir_res);
                                }
                                //console.log("RESULTS:", res);
                                results = results.concat(res);
                                if (!--pending) done(null, results);
                            });
                        }
                        else {
                            let inner_res = [];
                            inner_res.push(rel_file_path);
                            inner_res.push(stat.size);
                            inner_res.push(stat.mtime);
                            results.push(inner_res);
                            if (!--pending) done(null, results);
                        }
                    });
                });
            });
        };
        walk(look_path, look_path, function(err, results) {
            //if (err) throw err;
            if (err) reject(err);
            else resolve(results);
        });
        setTimeout(()=>{reject("ERR: timeout viewing the update directory");}, 5000);
    });
}

//* sync
function compare_manifests_2rp(old, fresh)
{
    let copy_names = [];
    let empty_dirs = [];
    let old_empty_dirs = get_empty_dirs(old);
    let fresh_empty_dirs = get_empty_dirs(fresh);
    empty_dirs = DiffArrays(fresh_empty_dirs, old_empty_dirs);

    old = trim_empty_dirs(old);
    fresh = trim_empty_dirs(fresh);
    //console.log("old=",old);
    //console.log("fresh=",fresh);
    //1.2. Extract flat Arrays with 'Names' from Arr2d
    const names = extract_flat_names(old, fresh);
    //1.3. Find new Names in fresh version
    let diff_frol = DiffArrays(names.fresh, names.old);
    copy_names = copy_names.concat(diff_frol);

    //2. FIND DIFFER BY SIZE AND BY DATE (EXEC TIME = 0.5 ms)
    //2.1. Find Intersec by Name
    let intersec = IntersecArrays(names.old, names.fresh);
    //console.log("intersec =", intersec);
    //2.2. Choose Only Intersected from 2d arrays
    old = get_intersecs_from_2d(old, intersec);
    fresh = get_intersecs_from_2d(fresh, intersec);
    //console.log("old =", old);
    //console.log("fresh =", fresh);
    //2.3. Sort both Arrays by Names
    old = old.sort(sort_by_name);
    fresh = fresh.sort(sort_by_name);
    //2.4. go to compare sizes or later by Date
    let names_diff_by_size = compare_intersec_by_size_or_date(old, fresh);
    copy_names = copy_names.concat(names_diff_by_size)

    //4. COPY CHANGES
    return {copy_names:copy_names, empty_dirs:empty_dirs};


    function get_empty_dirs(arr2d)
    {
        const NAME = 0;
        const EMPTY_DIR = 3;
        let res = [];
        for (let i in arr2d) {
            if (arr2d[i][EMPTY_DIR] == 'empty_dir') {
                res.push(arr2d[i][NAME]); 
            }
        }
        return res;
    }
    function trim_empty_dirs(arr2d)
    {
        let res = [];
        const EMPTY_DIR = 3;
        for (let i in arr2d) {
            if (arr2d[i][EMPTY_DIR] != 'empty_dir') {
                res.push(arr2d[i]);
            }
        }
        return res;
    }
    //* sync
    function extract_flat_names(old, fresh){
        let old_names = [], fresh_names = [];
        for (let i in old) {old_names.push(old[i][0]); }
        for (let i in fresh) {fresh_names.push(fresh[i][0]); }
        return {old: old_names, fresh: fresh_names }
    }
    //* sync
    function get_intersecs_from_2d(arr2d, intersec){
        let result = [];
        for (let row in arr2d) {
            for (let i in intersec) {
                if (arr2d[row][0] == intersec[i]) result.push(arr2d[row]);
            }
        }
        return result;
    }
    function sort_by_name(a,b) {
        if (a[0] > b[0]) return 1;
        if (a[0] == b[0]) return 0;
        if (a[0] < b[0]) return -1;
    }
    //* sync
    function compare_intersec_by_size_or_date(old, fresh){
        //* Here we have two same-length arrays sorted by Names, so indexes are always match
        const NAME = 0, SIZE = 1, DATE = 2;
        let names_diff_by_size_or_date = [];
        if (old.length == fresh.length) {
            for (let i in fresh) {
                if (old[i][SIZE] != fresh[i][SIZE]) {
                    names_diff_by_size_or_date.push(fresh[i][NAME]);
                } else {
                    let old_date = (typeof(typeof old[i][DATE]) == "object") ? (old[i][DATE].getTime()) : (Date.parse(fresh[i][DATE]));
                    let fresh_date = (typeof(typeof old[i][DATE]) == "object") ? (old[i][DATE].getTime()) : (Date.parse(fresh[i][DATE]));
                    //console.log(" old date=", old_date);
                    //console.log(" fresh date=", fresh_date);
                    if (fresh_date > old_date) {
                        names_diff_by_size_or_date.push(fresh[i][NAME]);
                    }
                }
            }
        }
        else { console.log("ERROR1: function 'compare_intersec()': lengths are different") }
        return names_diff_by_size_or_date;
    }
}

//--------------------
// UTIL FUNCTIONS
//--------------------

function DiffArrays(A,B)
{
    var M = A.length, N = B.length, c = 0, C = [];
    for (var i = 0; i < M; i++)
     { var j = 0, k = 0;
       while (B[j] !== A[ i ] && j < N) j++;
       while (C[k] !== A[ i ] && k < c) k++;
       if (j == N && k == c) C[c++] = A[ i ];
     }
   return C;
}

function IntersecArrays(A,B)
{
    var m = A.length, n = B.length, c = 0, C = [];
    for (var i = 0; i < m; i++)
     { var j = 0, k = 0;
       while (B[j] !== A[ i ] && j < n) j++;
       while (C[k] !== A[ i ] && k < c) k++;
       if (j != n && k == c) C[c++] = A[ i ];
     }
   return C;
}

function deep_clone_array(nd_arr)
{
    let result = [];
    for (let i in nd_arr) {
        if (typeof nd_arr[i] == "object") {
            let level2 = [];
            for (let j in nd_arr[i]) {
                level2.push(nd_arr[i][j]);
            }
            result.push(level2);
        }
        else { result.push(nd_arr[i]); }
    }
    return result;
}

