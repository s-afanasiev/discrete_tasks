# discrete_tasks
performing tasks on multiple nodes with centralized management and visualization
1) launch master.js on main node
2) copy 'client' folder on multiple nodes and launch launcher.js on them
3) now master and launcher begin to chat by socket.io. Launcher are designed only to run Controllers from controller.js
4) master have a shared folder, which can using for update files on nodes. 
   Master request update folder manifest and if it changed - tells to nodes it.
   Getting an update signal, Launcher and Controllers compare it with own trusted dirs and if it need, sync dirs and restart each other.
5) now the Master can send arbitrary commands and requests (for example, disk space, gpu info) to the Controller and get responses to them.
6) Also launch /visualiser/index.html for pleasing visualisation
