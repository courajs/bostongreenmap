// bostonparks object



var bp = {

  // array with currently visible map features (parks, facilites)
  overlays: [],

  // map configurations
  // TODO: document options
  mapconf: {},

  // paginaton threshold
  listlimit: 10,

  // There should be only one
  sharedinfowindow: new google.maps.InfoWindow({
    maxWidth: 260
  }),


  // initializes Google Map with given basemap argument [string]
  init_map: function(basemap) {

    var basemap = basemap || "basemap";

    // add google map
    this.map = new google.maps.Map(document.getElementById("map_canvas"), {
      zoom: 13,
      center: new google.maps.LatLng (42.307733,-71.09713),  //NEW: Franklin Park OLD: (42.31, -71.032), boston
      minZoom: 10,
      maxZoom: 17,
      mapTypeControlOptions: {
        position: google.maps.ControlPosition.TOP_RIGHT,
        mapTypeIds: [basemap, google.maps.MapTypeId.ROADMAP, google.maps.MapTypeId.SATELLITE], //,
        style: google.maps.MapTypeControlStyle.DROPDOWN_MENU
      },
      panControl: false,
      zoomControlOptions: {
        position: google.maps.ControlPosition.RIGHT_BOTTOM,
        style: google.maps.ZoomControlStyle.MEDIUM
      },
      streetViewControl: false
    })

    // add custom basemap layer
    this.map.mapTypes.set(basemap, new google.maps.MAPCMapType(basemap));
    this.map.setMapTypeId(basemap);

  },

  update_second_dropdown: function(search_type, filter_type, filter,value_key,django_neighborhood) {
    /*
    Pass in:
      The type of the second box for search_type
      The type of the first box for filter_type;
      The value to filter on for filter
      The value_key is whether to use 'id' or 'slug'
    */
    //Set the first item in the dropdown box
    var out = '<option value="">Select Your ';
    switch(search_type) {
    case 'neighborhood':
      out += 'Neighborhood/Town';
      break;
    case 'parktype':
      out += "Park Type";
      break;
    case 'activity':
      out += "Activity";
      break;
    }
    out += "</option>";
  	//out += "<option value='all'>All</option>"; // Need to hook onto this with javascript to load the whole list
    $.ajax({
      url:'/api/v1/'+search_type+'/?format=json&limit=1000&'+filter_type+'='+filter,
      dataType:'json',
      success:function(json){
        $.each(json['objects'], function(key, obj) {
          //check whether the value returned is supposed to be an id or a slug.
          //Create the new item in the dropdown list.
          if ( obj['slug'] == django_neighborhood){
            out+= '<option selected="selected" value="'+escape(obj[value_key])+'">' + obj['name']+'</option>';
            //coming in from neighborhood page
          } else {
            out+= '<option value="'+escape(obj[value_key])+'">' + obj['name']+'</option>';
          }
        });
        //replace the items in the dropdown list, and select the first element
        $("#neighborhood_"+search_type).html(out);
        $("#neighborhood_"+search_type).val($("#neighborhood_"+search_type+" option:first").val());
        if (typeof(django_neighborhood) != "undefined"){
          //Select the neighborhood passed in via the page parameter and auto search
          var neigh = $('#neighborhood_neighborhood option[value="'+django_neighborhood+'"]');
          neigh.attr('selected','selected');
          bp.play_get_parks(0);
        }
      }
    });
  },

  update_parklist: function(url, parkfilter){
      
    // don't use parkfilter if we have url
    if (url) {
      parkfilter = null;
    } else {
      url = "/api/v1/park/";
      // parkfilter defaults  
      parkfilter["format"] = "json";
      parkfilter["limit"] = this.listlimit;
    }

    $.getJSON(url,
      parkfilter,
      function(data) {
        var out = "";
        var latlngs = [];
        var park_ids = [];
        bp.clearmap();
        $.each(data['objects'], function(key, park) {
          var p = "<div class='parkitem'><h3><a href='/park/"+park['slug']+"'>"+park['name'] + "</a></h3><input type='button' id='tripadd_"+park['os_id']+"' class='add-trip-button' name='add-trip' value='Add to Trip' alt='"+park['name']+"' /></div>";
          park_ids[park_ids.length] = park['os_id'];

          if (park['description']) {p += "<p>"+ bp.truncate(park['description']) +"</p>";};
          // add park to map
          parkLatlngs = bp.renderpark(park["geometry"], {
            "name": park["name"],
            "description": park["description"]
          });
          latlngs.push.apply(latlngs, parkLatlngs);
          // adjust map extent
          if (bp.mapconf["zoomtoparks"]) bp.zoomtoparks(latlngs);
          
          out += p;
        });

        try {
            // show facilities
            if (bp.mapconf["showfacilites"] ) bp.loadfacilities({
              "park__neighborhoods": parkfilter["neighborhood"],
              "activity": parkfilter["activity"]
            });
        } catch (e) {
            console.log(e);
        }
        var previous = false;
        out += '<div id="prev_next_buttons">';
        // FIXME: we need some of the parkfilter options (activity and neighborhood) for facility queries
        if(data['meta']['previous']){
            out += '<a href="javascript:void(0)" id="prev_link">PREVIOUS</a>';
            previous = true;
        }
        if(data['meta']['next']){
            if(previous){ out += "&nbsp;&nbsp;";}
            out += '<a href="javascript:void(0)" id="next_link">NEXT</a>';
        }
        out += "</div>";
        $("#parklist").html(out);

        $("#prev_link").bind("click", function(){
            bp.update_parklist(data['meta']['previous']);
        });
        $("#next_link").bind("click", function(){
            bp.update_parklist(data['meta']['next']);
        });
        for (var pid in park_ids){
            bp.check_park_in_queue(park_ids[pid]);
            bp.park_trip_button_bind(park_ids[pid]);
        } 
    });
  },
  park_trip_button_bind: function(park_id,trippage){
      if (trippage == undefined) { trippage = false; }
      if (typeOf(park_id) == 'array'){
        for (var i in park_id) (function(i) {
            $("#tripadd_"+park_id[i]).bind('click',function(){
                bp.add_remove_park_trip(park_id[i],trippage);
            });
            bp.check_park_in_queue(park_id[i],trippage);
        })(i);
      } else {
        $("#tripadd_"+park_id).bind('click',function(){
            bp.add_remove_park_trip(park_id,trippage);
        });
      }
  },
  play_get_parks: function(offset) {
    var neighborhood = $("#neighborhood_neighborhood").val();
    var activity = $("#neighborhood_activity").val();
    if (activity === ""){ return;}
    if (neighborhood=== ""){ return;}
    var activities = new Array();
    $("#parklist").html("");
    this.update_parklist(null, {
      offset: offset,
      neighborhood: neighborhood,
      activity: activity
    });
  },
  explore_page_make_calls: function(){
      var checked_facilities = [];
      $(".facilitytype_checkbox:checked").each(function(){
         checked_facilities[checked_facilities.length] = parseInt($(this).attr("id").split("_")[1]);
      });
      var facility_string = checked_facilities.join(",");
 
	$.ajax({
           url:'/api/v1/exploresearch/?format=json&limit=1000&facilitytypes='+facility_string,
           dataType:'json',
           success:function(json){
               var parks = json['objects'];
           }
        });
  }, 
  /*
  	On change on the neighborhood, and checkboxes.
  	loadpark function
  	neighrborhodds prop
  	facility type props
  	loadparks
  	
  */
  explore_filter_activities: function(neighborhood_slug,parktype_id){
    var out = "";
     $.ajax({
       //probe the correct park url
       url:'/api/v1/exploreactivity/?format=json&limit=1000&neighborhood='+neighborhood_slug+'&parktype='+parktype_id,
       //url:url,
       dataType:'json',
       success:function(json){
         $.each(json['objects'], function(key, obj) {
           //check whether the value returned is supposed to be an id or a slug.
           //Create the new item in the dropdown list.
           out+= '<input type="checkbox" class="activity_checkbox" name="activity_checkboxes" value="'+obj['id']+'">'+obj['name']+'<br>';
         });
         //replace the items in the dropdown list, and select the first element
         $("#activity_checkboxes").html(out);
       }
     });
  },

  explore_filter_parkactivities: function(){
    var neighborhood = $("#neighborhood_neighborhood").val();
    var parktype = $("#neighborhood_parktype").val();
    var activities = new Array();
    $('#activity_checkboxes input:checked').each(function() {
      activities.push($(this).val());
    });
    $("#parklist").html("");
    $("#facilitylist").html("");
    if (activities.length == 0){
      return;
    }

    // find parks
    // find facilities

    activities = activities.join(",");
    var latlngs = [];
    bp.clearmap();
    $.ajax({
       //probe the correct park url
       url:'/api/v1/explorepark/?format=json&limit=1000&neighborhood='+neighborhood+'&parktype='+parktype+'&activity_ids='+activities,
       //url:url,
       dataType:'json',
       success:function(json){
         var out = "";
          $.each(json['objects'], function(key, park) {
             //DO SOMETHING BETTER HERE USING THE DATA.
          // out+= obj['name'] + " - " + obj['os_id']+'<br>';

          var p = "<h3><a href='/park/"+park['slug']+"'>"+park['name'] + "</a></h3>";
          if (park['description']) {p += "<p>"+ park['description']+"</p>";};
          out += p;

          // add park to map
          parkLatlngs = bp.renderpark(park["geometry"], {
            "name": park["name"],
            "description": park["description"]
          });
          latlngs.push.apply(latlngs, parkLatlngs);
          // adjust map extent
          if (bp.mapconf["zoomtoparks"]) bp.zoomtoparks(latlngs);


         });
  //       $("#parklist").html(out);
       }
     });

    $.ajax({
     url:'/api/v1/explorefacility/?format=json&limit=1000&neighborhood='+neighborhood+'&parktype='+parktype+'&activity_ids='+activities,
     dataType:'json',
     success:function(json){
      var out = "";
       $.each(json['objects'], function(key, facility) {
          //DO SOMETHING BETTER HERE USING THE DATA.
          // out += obj['name'] + " - " + obj['id']+'<br>';
          // add facility to map
          bp.renderfacility(facility["geometry"], {
            icon: facility["icon"],
            name: facility["name"],
            activity_string: facility["activity_string"],
            description: facility['description'],
            admin_url: facility["admin_url"],
            park_slug: facility['park_slug']
          })

       });
       // FIXME: list should be nested with parks, not attached
       // $("#facilitylist").html(out);
     }
   });
  },

  // load parks and render on map
  // FIXME: is mapconf set globally on page load?
  loadparks: function(parkfilter) {
      
    parkfilter["format"] = "json";
    bp.clearmap();
    var latlngs = [];
    // TODO: add bbox parameter to park query
    $.getJSON('/api/v1/park/', 
      parkfilter,
      function(data) {
        var parks = data.objects;
        
        $.each(parks, function(key, park) {

          parkLatlngs = bp.renderpark(park["geometry"], {
            "name": park["name"],
            "description": park["description"],
            "slug": park["slug"]
          });
          latlngs.push.apply(latlngs, parkLatlngs);
          // adjust map extent
          if (bp.mapconf["zoomtoparks"]) bp.zoomtoparks(latlngs);

          // show facilities
          // FIXME: track parks in array and filter with '__in' parameter in one request
          if (bp.mapconf["showfacilites"] ) bp.loadfacilities({
            "park": park["os_id"]
          });

        });
    });
  },
  loadparktrip: function(ids){
     var need_to_rebind=[];
     for(var x in ids){
       var parkfilter = {};
       need_to_rebind[need_to_rebind.length] = ids[x];
       parkfilter["format"] = "json";
       parkfilter["os_id"] = ids[x];
       $.getJSON('/api/v1/park/', 
           parkfilter,
           function(data) {
             var park = data.objects[0];
             $("#parklist").html($("#parklist").html() + "<input type='button' id='tripadd_"+park['os_id']+"' class='add-trip-button' name='add-trip' value='Add to Trip' alt='"+park['name']+"' /><br>");
             bp.check_park_in_queue(park['os_id']);
             for(var r in need_to_rebind){
                 bp.park_trip_button_bind(need_to_rebind[r]);
             }
       }); 
    }
  },

  maptheparktrip: function(ids){
      url = "http://maps.googleapis.com/maps/api/directions/json?origin=42.30055499999974,-71.06547850000001&destination=42.29352942843293,-71.05678739548821&sensor=false";

 },

  // loac facilities and render on map
  loadfacilities: function(facilityfilter) {

    facilityfilter["format"] = "json";

    $.getJSON('/api/v1/facility/',
      facilityfilter,
      function(data) {
        var facilities = data.objects; 
        $.each(facilities, function(key, facility) {

          // add facilities to map
          bp.renderfacility(facility["geometry"], {
            icon: facility["icon"],
            name: facility["name"],
            activity_string: facility["activity_string"],
            admin_url: facility["admin_url"],
            description: facility['description'],
            park_slug: facility['park_slug']
          })

      });
    });
  },

  renderpark: function(geometry, properties) {
    // accepts multipart geometries and property object
    var latlngs = [];
    $.each(geometry, function(key, part) {
        var parkPoly = new google.maps.Polygon({
          paths: google.maps.geometry.encoding.decodePath(part["points"]),
          levels: bp.decodeLevels(part["levels"]),
          fillColor: '#00DC00',
          fillOpacity: 0.6,
          strokeWeight: 0,
          zoomFactor: part["zoomFactor"], 
          numLevels: part["numLevels"],
          map: bp.map
        });

        if (bp.mapconf["parkinfowindow"]) {
          google.maps.event.addListener(parkPoly, "click", function(evt) {
            // invisble park marker to anchor info window
            var parkMarker = new google.maps.Marker({
              map: bp.map,
              position: new google.maps.LatLng(evt.latLng.lat(), evt.latLng.lng()),
              visible: false
            });

            var parkinfocontent = "<div class='iwindow'><h2>" + properties["name"] + "</h2>" +
                                "<div>"+properties['description']+"</div>" +
                                "<strong><a href='/park/" + properties['slug']+"/'>" + "Learn more about this park" + "</a></strong>" ;
            bp.sharedinfowindow.setContent(parkinfocontent);
            bp.sharedinfowindow.open(bp.map, parkMarker)
          });
        }

        // extend latlngs
        latlngs.push.apply(latlngs, parkPoly.getPath().getArray());
        // track overlay
        bp.overlays.push(parkPoly);
    });
    return latlngs;
  },

  renderfacility: function(geometry, properties) {
    // marker with custom icon
    var facilityicon = properties["icon"];
    var facilitylatlng = new google.maps.LatLng(geometry["coordinates"][1], geometry["coordinates"][0]);
    var facilitymarker = new google.maps.Marker({
      position: facilitylatlng,
      title: properties["name"],
      map: bp.map,
      icon: facilityicon
    });
    // track overlay
    bp.overlays.push(facilitymarker);
    // marker infowindow
    var facilityinfocontent = "<div class='iwindow'><h2>" + properties["name"] + "</h2>" +
                              "Activities: " + properties["activity_string"] + "</div>" + 
                              "<div>"+properties['description']+"</div>" +
                              "<strong><a href='/park/" + properties['park_slug']+"/'>" + "Learn more about this park" + "</a></strong>" ;
    if (typeof staff !== 'undefined' && staff === true) {
      facilityinfocontent += "<br><a href='" + properties["admin_url"] + "'>Edit</a>";
    }
    google.maps.event.addListener(facilitymarker, 'click', function() {
      bp.sharedinfowindow.setContent(facilityinfocontent);
      bp.sharedinfowindow.open(bp.map, facilitymarker);
    });
  },

  zoomtoparks: function(latlngs) {
    // accepts array of lat/long pairs
    var latlngbounds = new google.maps.LatLngBounds();
    for ( var i = 0; i < latlngs.length; i++ ) {
      latlngbounds.extend(latlngs[i]);
    }
    bp.map.fitBounds(latlngbounds);
  },

  // remove all overlays (parks, facilities) from map
  clearmap: function() {
    while(this.overlays[0]){
      this.overlays.pop().setMap(null);
    }
  },

  // FIXME: not ideal for performance. better to make one initial request for full object
  // and parse it on client to pair dropdowns  
  // appends or updates (if exists) a dropdown for given modelclass to conatainer element
  build_dropdown: function(container, modelclass, filter, selected) {

    var dropdown = $("select#" + modelclass);

    if ( dropdown.length > 0 ) { 
      // update existing
      dropdown.empty();
    } else {
      // create new
      dropdown = $("<select />", {
        "id": modelclass
      });
      $(container).append(dropdown);
    }
    
    var filter = filter || {};
    filter["format"] = "json";

    var selected = selected || "";
    
    $.getJSON("/api/v1/" + modelclass + "/", 
      filter,
      function(data) {
        var titleoption = $("<option />", {
          "value": ""
        })
        .html(bp.titlecase("Select Your " + modelclass));
        dropdown.append(titleoption)
        $.each(data.objects, function(key, obj) {
          var option = $("<option />", {
            value: obj["id"]
          })
          .data("slug", obj["slug"])
          .html(obj["name"]);
          dropdown.append(option);
        });
        // select
        dropdown.val(selected);
    });

    return dropdown;
  },
  
  // pairs two dropdowns to only show possible value combinations
  // accepts list of dropdown objects
  pair_dropdown: function(dd) {
    
    $.each(dd, function(key, dropdown) {

      // previous list item
      var previous = ((key - 1) < 0) ? key -1 + dd.length : key - 1;

      $(dropdown).on("change", function(e) {

        var selected = $(dd[previous], "option:selected").val();
        var filter = {};

        if ($(this).val() !== "") filter[$(dropdown).attr("id")] = $(this).val();

        var container = $(dropdown).parent();

        // update other dropdown
        bp.build_dropdown(container, $(dd[previous]).attr("id"), filter, selected);
      });
    });
  },

  /*
   * UTILITIES
   */

  // encoded polylines for google maps
  decodeLevels: function(encodedLevelsString) {
      var decodedLevels = [];
      for (var i = 0; i < encodedLevelsString.length; ++i) {
          var level = encodedLevelsString.charCodeAt(i) - 63;
          decodedLevels.push(level);
      }
      return decodedLevels;
  },

  truncate: function(string, nrchars) {
    // accepts a string and a number of characters the string shcould be truncated to
    var nrchars = nrchars || 100;
    var string = string.trim().substring(0, nrchars).split(" ").slice(0, -1).join(" ") + "...";
    return string;
  },

  titlecase: function(string)
  {
    return string.replace(/\w\S*/g, function(txt){
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
  },

  // check for valid email
  validate_email: function(email) {
    var emailReg = /^([a-zA-Z0-9_\.\-\+\'])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;
    return emailReg.test(email);
  },

  adjust_layerswitcher: function() {
    // adjust top margin for layer switcher
    google.maps.event.addDomListener(bp.map, 'tilesloaded', function(){  
      if($('#layerswitcher').length==0){
        $("div.gmnoprint").last().wrap('<div id="layerswitcher" />').css("margin-top", "76px");
      }
    });
  },


  //TripSection
  add_remove_park_trip: function(park_id, trippage){
     if (trippage == undefined) { trippage = false; }
     var trip_array = $.jStorage.get("trip",[]);
     if ($.inArray(park_id,trip_array) >= 0){
         for(var i=0; i<trip_array.length;i++){
             if(trip_array[i] ==park_id){
                 trip_array.splice(i,1);
             }
         }
         if(!trippage){
             $("#tripadd_"+park_id).val("Add to Trip");
         } else {
             $("#tripadd_"+park_id).parent().remove();
         }
     } else {
         if(trip_array.length < 8){
             trip_array[trip_array.length] = park_id;
             $("#tripadd_"+park_id).val("Remove from Trip");
         }
     }
     $.jStorage.set("trip",trip_array);
     bp.count_parks_in_queue();
  },
  check_park_in_queue: function(park_id){
     var trip_array = $.jStorage.get("trip",[]);
     if ($.inArray(park_id,trip_array) >= 0){
         $("#tripadd_"+park_id).val("Remove from Trip");
     } else {
         $("#tripadd_"+park_id).val("Add to Trip");
     }
     bp.count_parks_in_queue();
  },
  count_parks_in_queue: function(){
      var trip_array = $.jStorage.get("trip",[]);
      var count = trip_array.length;
      if (count == 8) {
          $("a.plan").html("PLAN A TRIP ( MAX "+count+" STOPS )");
      } else if(count > 0){
          $("a.plan").html("PLAN A TRIP ("+count+" STOP(S) )");
      } else {
          $("a.plan").html("PLAN A TRIP");
      }
  },
  trip_generate_list: function(){
    var trip_array = $.jStorage.get("trip",[]);
    if(trip_array.length == 0){
        return;
    }
    var trip_array_string = trip_array.join(",");
    var url = "/api/v1/park/";
    var parkfilter = {};
    parkfilter["format"] = "json";
    parkfilter["os_id_list"] = trip_array_string;
    $.getJSON(url, parkfilter,
        function(data) {
            var park_ids = [];
            park_trip_list = data['objects'];
            $("#parklist").html("");
            for(var i = 0;i<data['objects'].length;i++){
              var park=data['objects'][i];
              var litem = '<li class="ui-state-default parkitem clearfix sortable_icon" id="tripitem_'+
                          park['os_id']+
                          '"><h3>'+
                          park['name']+
                          '</h3><input type="button" id="tripadd_'+
                          park['os_id']+
                          '" class="add-trip-button" name="add-trip" value="Remove from Trip" alt="'+
                          park['name']+
                          '" /> </li>';
              park_ids[park_ids.length] = park['os_id'];
              $("#parklist").append(litem);
            }
            bp.park_trip_button_bind(park_ids,true);
        });
  },
  reorder_trip_list: function(){
      var trips = [];
      var list = $("#parklist");
      if (list.length < 1) { return; }
          list.children().each(function(){
          if($(this).attr('id') != undefined){
              var id = $(this).attr('id')
              id = id.substring(9);
              trips[trips.length] = parseInt(id);
          }
      });
      $.jStorage.set("trip",trips);
  },
  get_coords: function(){
      var coords = [];
      for(var i in park_trip_list){
          coords[coords.length] = park_trip_list[i]['lat_long'];
      }
      return coords;
  },

  trip_generate_obj: function(start,stop,mode){
      var coords = bp.get_coords();
      var waypoints  = [];
      if(stop == ""){
          stop = coords.pop();
          if(stop == undefined){
              stop = start;
          } else {
              stop = stop[0]+","+stop[1];
          }
          //Get a stop somehow.
      }
      for(var i = 0;i < coords.length;i++){
          var c = coords[i][0]+","+coords[i][1];
          waypoints[waypoints.length] = {location:c, stopover:true};
      }
      
      // clear previous results
      try {  
        directionsDisplay.setMap(null);  
      }  
      catch (e) {  
         // statements to handle any exceptions  
         // console.log(e); // pass exception object to error handler  
      }  

      directionsDisplay = new google.maps.DirectionsRenderer({
        polylineOptions: {
          strokeColor: "#00DC00",
          strokeWeight: 8,
          strokeOpacity: 0.4
        }
      });
      directionsDisplay.setMap(bp.map);

          // Only calculate a route if they have waypoints.
          var directionDisplay; 
          var directionsService = new google.maps.DirectionsService(); 
          if(mode == "bicycling"){
              mode = google.maps.DirectionsTravelMode.BICYCLING;
          } else {
              mode = google.maps.DirectionsTravelMode.WALKING;
          }
          var request;
          if(waypoints.length > 0){
              request = { 
                  origin:start,  
                  destination:stop, 
                  waypoints:waypoints,
                  travelMode:mode,
                  provideRouteAlternatives: false
              }; 
          } else {
              request = { 
                  origin:start,  
                  destination:stop, 
                  travelMode:mode, 
                  provideRouteAlternatives: false
              }; 
          }
          directionsService.route(request, function(response, status) { 
            if (status == google.maps.DirectionsStatus.OK) { 
               directionsDisplay.setDirections(response);
            } 
          });
  }
}




$(function() {   

  // execute onload with global parameter specified in django template
  if ( bp.parkfilter ) bp.loadparks(bp.parkfilter, bp.mapconf);

  // tooltip whenever a facility icon is displayed in a list
  $(".facility-icon").tooltip();

});


function typeOf(obj) {
  if ( typeof(obj) == 'object' ){
    if (obj.length){
      return 'array';
    } else{
      return 'object';
    } 
  }else {
     return typeof(obj);
  }
}
