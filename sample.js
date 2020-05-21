


	
	var sample_behavior = 
	
	{
		"void_main":
		{
			//this is always the first fuction called
			
			
			"if_err":
			{
				"call":"sample_err_1"
			},
			"if_timeout":
			{
				"call":"sample_timeout_1"
			},
			"if_answer":
			[
				{
					"validate":"is_zero",
					"if_true":
					[
						30000,   // if number = wait
						"sample_fuction_02",
						10000,
						"sample_fuction_zero_is_true",
						"return"
					],
					"if_false":""
				},
				{
					"validate":"is_one",
					"if_true":"sample_fuction_one_is_true"//,
					//"if_false":""
				},
				[
					//else = novalidate
					"sample_fuction_not_zero_or_one"
					10,  // wait 10 ms
					"sample_fuction_01"
				]
			]
			
		},
		
		"sample_fuction_01":
		{
			
		},
		
		"sample_fuction_02":
		{
			
		},
		
		
		"check_disk_space":
		{
			// go check disk space,  retry, timeout, etc
			"if_err":
			{
				"call":"err_disk_space"
			},
			"if_timeout":
			{
				"call":"timeout_disk_space"
			},
			"if_answer":
			[
				{
					"validate":"lte_2gb",
					"if_true":
					[
						"clear_disk_cache",
						//300000,
						//"check_disk_space",
						//"return"
					]
				},
				[
					300000,
					"check_disk_space",
					"return"
				]
			]
			
		},
		
		
		
		"sample_fuction_zero_is_true":
		{
			
		},
		
		"sample_fuction_one_is_true":
		{
			
		},
		
		"sample_fuction_not_zero_or_one":
		{
			
		},
		
		
		
		"sample_timeout_1":
		{
			
		},
		
		"sample_err_1":
		{
			
		}

	}
	
	
	function lte_2gb(data, passthrough_info, pizdetz)
	{
		if(data < 2147483648)
		{
			return true;
		}
		return false;
	}
	
	
	function is_zero(data, passthrough_info, pizdetz)
	{
		if(data == 0)
		{
			return true;
		}
		return false;
	}
	
	function is_one(data, passthrough_info, pizdetz)
	{
		if(data == 1)
		{
			return true;
		}
		return false;
	}
	
	function is_greater_than_one(data, passthrough_info, pizdetz)
	{
		if(data > 1)
		{
			return true;
		}
		return false;
	}
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	